# Pane verification map

Use [SKILL.md](../SKILL.md) for isolation, launch, doctor, evidence and cleanup. Every native recipe requires the owned disposable profile. Run the fixture helper on every change; run affected native recipes before handing it to Jasiel. Picker or layout changes require both entry paths and every layout. Persistence changes require full-restart checks. Unrun native checks stay NOT RUN.

| Feature | Automatic evidence in npm test | Native acceptance recipe |
| --- | --- | --- |
| Picker | Markup, replacement and add/join logic | [picker](picker.md) |
| Layout menu | Shortcut defaults/parser/conflicts | [layout-menu](layout-menu.md) |
| Settings | Bounds/schema and keybindings | [settings](settings.md) |
| Pane restart memory | Mock presentation restore; full restart unproven | [restart-memory](restart-memory.md) |
| Split right | Mock layout/presentation/geometry logic | [split-right](split-right.md) |
| Split below | Mock layout/presentation/geometry logic | [split-below](split-below.md) |
| Grid | Mock layout/presentation/geometry logic | [grid](grid.md) |
| Horizontal accordion | Mock layout/presentation/geometry logic | [accordion](accordion.md) |
| Scrolling | Mock layout/presentation/geometry logic | [scrolling](scrolling.md) |
| Floating | Mock layout/presentation/geometry logic | [floating](floating.md) |

The automatic routine also runs icons, update notices, diagnostics, schema validation and syntax checks. It does not launch Zen. Restart recipes intentionally cover full-process persistence that fixtures cannot prove. Record revision, profile, Zen/Sine versions, feature IDs, entry points and PASS/FAIL/NOT RUN in each proof. Keep artifacts after teardown. Do not treat internal controller calls or a screenshot alone as user-path proof.
