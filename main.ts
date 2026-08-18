import { App } from "astal/gtk3"
// Use default import (no curly braces)
import ScrollbarWidget from "/home/ozgur/.config/scripts/Scrollbar/niri-scrollbar.ts"

App.start({
    requestHandler: (request, res) => res("ok"),
    main: () => {
        // Fetch all active displays and spawn a scrollbar on each
        App.get_monitors().map(ScrollbarWidget)
    },
})
