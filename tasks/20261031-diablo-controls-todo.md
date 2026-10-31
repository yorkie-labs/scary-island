# 2026-10-31 · Diablo-style keyboard & mouse

Request: "키보드, 마우스 인터렉션을 디아블로 처럼 만들고 싶은데, 고려해줘"

## Design
- [call] Diablo mode is the default; V toggles back to the third-person orbit
  camera (saved per browser).
- Fixed isometric follow camera (yaw 45°, pitch ~55°), wheel zoom, occluders fade.
- LMB ground: move (hold = follow cursor). LMB enemy/ore/planks: walk in range,
  swing (hold = keep swinging). LMB pickup/interactable: walk there, use it.
- Shift+LMB: swing in place toward cursor. RMB: selected tool toward cursor.
- Space: evade roll toward cursor. 1-3 tools, 4 drink potion. E/Q/B/F as before.
- Hover: cursor style + name plate (monsters red, things yellow) + ground marker.
- Watchers/Guardian "observed" = Yorkie faces them (cone + line of sight).
- Cave: hide ceiling and upper wall rows in iso view.

## Todo
- [x] iso camera + occluder fading
- [x] pointer picking, orders, hover UI
- [x] player accepts world-space move + order system
- [x] observed rule per mode; cave split
- [x] key hints per mode in dialogs/menu
- [x] headless check: click-move, click-attack ore, click-pickup, watcher rule

## Review (2026-10-31)

- Headless checks: click-move lands within 0.28 m; hammer by click; holding on
  ore mines it; Rocky name plate; Space rolls toward the cursor; V toggles.
- Camera (user: "too much from the top of the head"): was 52° pitch, 55° FOV,
  11 m. ARPGs sit ~30–35° with a narrow lens far back; now 35°, FOV 35°, 19 m.
- Clicks on high places (user): picking now hits ground meshes only; a house,
  tree or cliff in front means "its foot on our side"; targets snap to
  walkable cells; A* (1 m grid, lazy Rapier sampling, step ≤ 1.1 m) walks
  around obstacles; unreachable clicks go as far as possible straight toward
  the click, else to the nearest reachable spot; a click is never ignored.
  Ridge click → stops at the foot (no climbing); roof click → front of house;
  tent detour; 4/4 ledge clicks handled.
- Full playthrough still passes (script flake in the tunnel fixed in script).
- Fonts load non-blocking (a slow font server stalled page load).

## Next (proposed, not done)
- Diablo II interface pass — see the summary given to the user.
