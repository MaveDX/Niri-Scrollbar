// niri-scrollbar.ts
// Auto-hiding bottom scrollbar widget for niri
// Connects to niri-scroll-daemon for smooth horizontal scrolling
// Inherits colors and radius from ~/.config/niri/noctalia.kdl

import { App, Astal, Gtk } from "astal/gtk3"
import { Variable, bind, execAsync } from "astal"
import Gio from "gi://Gio"
import GLib from "gi://GLib"
import Gdk from "gi://Gdk"

const SOCK_PATH = "/tmp/niri-scroll.sock"
const NIRI_CONFIG = `${GLib.get_home_dir()}/.config/niri/noctalia.kdl`

// ─── Niri config parsing ─────────────────────────────────────────────────────

interface NiriTheme {
  activeColor: string
  inactiveColor: string
  radius: number
}

function parseNiriTheme(): NiriTheme {
  try {
    const [ok, bytes] = GLib.file_get_contents(NIRI_CONFIG)
    if (!ok) throw new Error("unreadable")
    const text = new TextDecoder().decode(bytes)

    const activeMatch   = text.match(/active-color\s+"([^"]+)"/)
    const inactiveMatch = text.match(/inactive-color\s+"([^"]+)"/)
    const radiusMatch   = text.match(/geometry-corner-radius\s+(\d+(?:\.\d+)?)/)

    return {
      activeColor:   activeMatch?.[1]  ?? "#7fc8ff",
      inactiveColor: inactiveMatch?.[1] ?? "#3a3a4a",
      radius:        radiusMatch ? Math.round(parseFloat(radiusMatch[1])) : 8,
    }
  } catch {
    return { activeColor: "#7fc8ff", inactiveColor: "#3a3a4a", radius: 8 }
  }
}

// ─── Daemon socket ────────────────────────────────────────────────────────────

class ScrollDaemon {
  private conn: Gio.SocketConnection | null = null

  private connect() {
    try {
      const client = new Gio.SocketClient()
      const addr   = Gio.UnixSocketAddress.new(SOCK_PATH)
      this.conn    = client.connect(addr, null)
    } catch {
      this.conn = null
    }
  }

  send(msg: object) {
    if (!this.conn) this.connect()
    try {
      const data = new TextEncoder().encode(JSON.stringify(msg) + "\n")
      this.conn!.get_output_stream().write_bytes(new GLib.Bytes(data), null)
    } catch {
      this.conn = null
    }
  }

  begin()            { this.send({ type: "begin" }) }
  update(dx: number) { this.send({ type: "update", dx }) }
  end()              { this.send({ type: "end" }) }
}

// ─── Niri state ───────────────────────────────────────────────────────────────

interface NiriState {
  columnCount: number
  focusedIndex: number
  workspaceCount: number
  focusedWorkspace: number
}

const state = new Variable<NiriState>({
  columnCount: 1,
  focusedIndex: 0,
  workspaceCount: 1,
  focusedWorkspace: 0,
})

async function refreshState() {
  try {
    const [winsRaw, wsRaw] = await Promise.all([
      execAsync("niri msg -j windows"),
      execAsync("niri msg -j workspaces"),
    ])
    const windows    = JSON.parse(winsRaw) as any[]
    const workspaces = JSON.parse(wsRaw)   as any[]

    const focused    = windows.find((w: any) => w.is_focused)
    const activeWs   = workspaces.find((w: any) => w.is_active)
    const wsWindows  = windows.filter((w: any) => w.workspace_id === activeWs?.id)
    const sorted     = [...wsWindows].sort((a, b) => (a.x ?? 0) - (b.x ?? 0))
    const focusedIdx = sorted.findIndex((w: any) => w.id === focused?.id)

    state.set({
      columnCount:      Math.max(1, sorted.length),
      focusedIndex:     Math.max(0, focusedIdx),
      workspaceCount:   workspaces.length,
      focusedWorkspace: workspaces.findIndex((w: any) => w.is_active),
    })
  } catch {}
}

function subscribeNiriEvents() {
  const proc = new Gio.Subprocess({
    argv:  ["niri", "msg", "event-stream"],
    flags: Gio.SubprocessFlags.STDOUT_PIPE,
  })
  proc.init(null)

  const stream = new Gio.DataInputStream({
    base_stream: proc.get_stdout_pipe()!,
  })

  const interesting = [
    "WindowFocusChanged", "WindowOpenedOrChanged",
    "WindowClosed", "WorkspaceActivated",
  ]

  const readLine = () => {
    stream.read_line_async(GLib.PRIORITY_DEFAULT, null, (_, res) => {
      try {
        const [line] = stream.read_line_finish_utf8(res)
        if (line) {
          try {
            const ev = JSON.parse(line)
            if (Object.keys(ev).some(k => interesting.includes(k)))
              refreshState()
          } catch {}
          readLine()
        }
      } catch {}
    })
  }

  refreshState()
  readLine()
}

// ─── Widget ───────────────────────────────────────────────────────────────────

const { TOP, LEFT, RIGHT } = Astal.WindowAnchor

export default function NiriScrollbar() {
  const theme  = parseNiriTheme()
  const daemon = new ScrollDaemon()

  subscribeNiriEvents()

  const hovering = new Variable(false)
  let lastDragX  = 0
  let isDragging = false
  let isPointerInside = false
  let hoverTimeoutId: number | null = null

  const evaluateVisibility = () => {
    if (hoverTimeoutId !== null) {
      GLib.source_remove(hoverTimeoutId)
      hoverTimeoutId = null
    }

    if (isPointerInside || isDragging) {
      hovering.set(true)
    } else {
      hoverTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 150, () => {
        hovering.set(false)
        hoverTimeoutId = null
        return GLib.SOURCE_REMOVE
      })
    }
  }

  // ── CSS ──
  const css = `
    window { background-color: transparent; }
    
    /* CRITICAL FIX: 1% opacity black. Pure transparent gets ignored by Wayland input geometry.
       This ensures the ENTIRE monitor width is clickable.
    */
    .trigger-zone { background-color: rgba(0, 0, 0, 0.01); }
    
     .ws-btn {
      background: none;
      border: none;
      outline: none;
      box-shadow: none;
      border-radius: 0px;
      color: ${theme.activeColor};
      padding: 0 4px;
      font-size: 8px;
      min-width: 14px;
    }    
    
    .ws-btn:hover { background-color: alpha(${theme.activeColor}, 0.15); }

  `
  App.apply_css(css, true)

  // ── Thumb ──
  const thumb = new Gtk.Box({ hexpand: false, vexpand: false })
  thumb.get_style_context().add_class("scroll-thumb")

  bind(state).subscribe((s) => {
    const pct    = s.columnCount > 1 ? s.focusedIndex / (s.columnCount - 1) : 0
    const trackW = thumb.get_parent()?.get_allocated_width() ?? 360
    const thumbW = Math.max(40, trackW / Math.max(s.columnCount, 1))
    const maxOff = trackW - thumbW
    thumb.set_size_request(Math.round(thumbW), -1)
    thumb.set_margin_start(Math.round(pct * maxOff))
  })

  // ── Track ──
  const track = new Gtk.Box({ hexpand: true })
  track.get_style_context().add_class("scroll-track")
  track.add(thumb)

  // ── Workspace buttons ──
  const wsUp = new Gtk.Button({ label: "▲" })
  wsUp.get_style_context().add_class("ws-btn")
  wsUp.connect("clicked", () => execAsync("niri msg action focus-workspace-up").catch(() => {}))

  const wsDown = new Gtk.Button({ label: "▼" })
  wsDown.get_style_context().add_class("ws-btn")
  wsDown.connect("clicked", () => execAsync("niri msg action focus-workspace-down").catch(() => {}))

  // ── Visible Bar ──
  const bar = new Gtk.Box({ hexpand: false }) 
  bar.set_size_request(0, -1) 
  bar.get_style_context().add_class("scrollbar-bar")
  bar.add(wsUp)
  bar.add(track)
  bar.add(wsDown)

  // ── Revealer ──
  
  // Set initial opacity to 0
  bar.set_opacity(0) 

  // 2. Bind visibility to your hovering variable
  bind(hovering).subscribe(v => {
    bar.set_opacity(v ? 1 : 0)
  })

  // 3. Keep the static Layout Wrapper
  const layout = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    hexpand: true,
    vexpand: true,
    valign: Gtk.Align.END,
    halign: Gtk.Align.CENTER, 
  })
  layout.add(bar) // Add the bar here instead of the revealer

  // ── Hit Zone Box (Full Screen Width) ──
  const hitZoneBox = new Gtk.EventBox({
    visible: true,
    heightRequest: 40,
    hexpand: true, 
  })
  hitZoneBox.get_style_context().add_class("trigger-zone") // Applies the 1% opacity
  hitZoneBox.add(layout)
  
  // Explicitly request the signals we need
  hitZoneBox.add_events(Gdk.EventMask.ENTER_NOTIFY_MASK | Gdk.EventMask.LEAVE_NOTIFY_MASK)

  // Replace duplicate controllers with clean enter/leave logic
  hitZoneBox.connect("enter-notify-event", () => {
    isPointerInside = true
    evaluateVisibility()
    return false
  });

  hitZoneBox.connect("leave-notify-event", (_w, event: any) => {
    // CRITICAL FIX: Ignore leave events triggered by entering child buttons
    if (event.detail === Gdk.NotifyType.INFERIOR) return false
    
    isPointerInside = false
    evaluateVisibility()
    return false
  });

  // ── Global Drag Gesture ──
  const drag = Gtk.GestureDrag.new(hitZoneBox)
  drag.set_button(1)
  
  drag.connect("drag-begin", () => {
    // CRITICAL FIX: In GTK, `offsetX` during update is the delta from 0, not from the screen coordinate.
    // Setting this to 0 prevents the massive initial negative jump.
    lastDragX  = 0 
    isDragging = true
    daemon.begin()
    evaluateVisibility() 
  })
  
  // ── Infinite Drag Logic ──
  drag.connect("drag-update", (_g: any, offsetX: number, _y: number) => {
    if (!isDragging) return
    
    // Calculate the movement delta from the last frame
    const dx = offsetX - lastDragX
    
    // ALWAYS update lastDragX to track the "intent" 
    // even if the cursor is stuck at the edge
    lastDragX = offsetX
    
    // Send the scroll command based on the delta
    // This works even if the cursor is physically unable to move further
    daemon.update(Math.round(dx * 12)) 
  })  

  drag.connect("drag-end", () => {
    if (isDragging) {
      daemon.end()
      isDragging = false
    }
    evaluateVisibility() 
  })

  // Prevent gesture from being garbage collected by GJS
  // @ts-expect-error
  hitZoneBox._dragGesture = drag 
  
  hitZoneBox.show_all()

  // ── Window ──
  const win = new Astal.Window({
    application:   App,
    layer:         Astal.Layer.OVERLAY,
    anchor:        TOP | LEFT | RIGHT, 
    exclusivity:   Astal.Exclusivity.IGNORE,
    visible:       true,
    child:         hitZoneBox,
  })
  win.set_namespace("niri-scrollbar")

  return win

  // Add this helper to your script
  async function wrapCursor(x: number, y: number, maxWidth: number) {
    let targetX = x;
    
    // Wrap to the right edge if hitting left
    if (x <= 1) {
      targetX = maxWidth - 2;
    } 
    // Wrap to the left edge if hitting right
    else if (x >= maxWidth - 1) {
      targetX = 2;
    }

    if (targetX !== x) {
      await execAsync(`niri msg action-cursor-warp ${targetX} ${y}`);
    }
  }
}
