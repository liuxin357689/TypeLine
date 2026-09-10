/* ==========================================================================
 * 键盘布局数据（设计文档 7.2，数据驱动）
 * window.TP_KEYBOARD_LAYOUT：104 键标准键盘
 * 字段：r = grid 行坐标；c = grid 列坐标（1/4 键宽为单位，共 91 列）；
 *       w = 跨列宽度（grid span）；rs = 跨行（grid row span，默认 1）；
 *       label = 键面显示文字；code = KeyboardEvent.code
 * 区段：功能键区(Esc/F1-F12) / 主键区 / 编辑区 / 方向键 / 数字小键盘
 * code→key 映射由 KeyboardTest 组件遍历本数组自动生成（O(1) 命中）
 * ========================================================================== */
window.TP_KEYBOARD_LAYOUT = [
  /* ---- 功能键区（r1） ---- */
  { r: 1, c: 1,  w: 4, rs: 1, label: "Esc",  code: "Escape" },
  { r: 1, c: 6,  w: 4, rs: 1, label: "F1",   code: "F1" },
  { r: 1, c: 10, w: 4, rs: 1, label: "F2",   code: "F2" },
  { r: 1, c: 14, w: 4, rs: 1, label: "F3",   code: "F3" },
  { r: 1, c: 18, w: 4, rs: 1, label: "F4",   code: "F4" },
  { r: 1, c: 23, w: 4, rs: 1, label: "F5",   code: "F5" },
  { r: 1, c: 27, w: 4, rs: 1, label: "F6",   code: "F6" },
  { r: 1, c: 31, w: 4, rs: 1, label: "F7",   code: "F7" },
  { r: 1, c: 35, w: 4, rs: 1, label: "F8",   code: "F8" },
  { r: 1, c: 40, w: 4, rs: 1, label: "F9",   code: "F9" },
  { r: 1, c: 44, w: 4, rs: 1, label: "F10",  code: "F10" },
  { r: 1, c: 48, w: 4, rs: 1, label: "F11",  code: "F11" },
  { r: 1, c: 52, w: 4, rs: 1, label: "F12",  code: "F12" },

  /* ---- 编辑区（r1-r3 上三行） ---- */
  { r: 1, c: 62, w: 4, rs: 1, label: "PrtSc", code: "PrintScreen" },
  { r: 1, c: 66, w: 4, rs: 1, label: "ScrLk", code: "ScrollLock" },
  { r: 1, c: 70, w: 4, rs: 1, label: "Pause", code: "Pause" },
  { r: 2, c: 62, w: 4, rs: 1, label: "Ins",   code: "Insert" },
  { r: 2, c: 66, w: 4, rs: 1, label: "Home",  code: "Home" },
  { r: 2, c: 70, w: 4, rs: 1, label: "PgUp",  code: "PageUp" },
  { r: 3, c: 62, w: 4, rs: 1, label: "Del",   code: "Delete" },
  { r: 3, c: 66, w: 4, rs: 1, label: "End",   code: "End" },
  { r: 3, c: 70, w: 4, rs: 1, label: "PgDn",  code: "PageDown" },

  /* ---- 数字小键盘（r1-r5） ---- */
  { r: 1, c: 76, w: 4, rs: 1, label: "Num",   code: "NumLock" },
  { r: 1, c: 80, w: 4, rs: 1, label: "/",     code: "NumpadDivide" },
  { r: 1, c: 84, w: 4, rs: 1, label: "*",     code: "NumpadMultiply" },
  { r: 1, c: 88, w: 4, rs: 1, label: "-",     code: "NumpadSubtract" },
  { r: 2, c: 76, w: 4, rs: 1, label: "7",     code: "Numpad7" },
  { r: 2, c: 80, w: 4, rs: 1, label: "8",     code: "Numpad8" },
  { r: 2, c: 84, w: 4, rs: 1, label: "9",     code: "Numpad9" },
  { r: 2, c: 88, w: 4, rs: 2, label: "+",     code: "NumpadAdd" },
  { r: 3, c: 76, w: 4, rs: 1, label: "4",     code: "Numpad4" },
  { r: 3, c: 80, w: 4, rs: 1, label: "5",     code: "Numpad5" },
  { r: 3, c: 84, w: 4, rs: 1, label: "6",     code: "Numpad6" },
  { r: 4, c: 76, w: 4, rs: 1, label: "1",     code: "Numpad1" },
  { r: 4, c: 80, w: 4, rs: 1, label: "2",     code: "Numpad2" },
  { r: 4, c: 84, w: 4, rs: 1, label: "3",     code: "Numpad3" },
  { r: 4, c: 88, w: 4, rs: 2, label: "Enter", code: "NumpadEnter" },
  { r: 5, c: 76, w: 8, rs: 1, label: "0",     code: "Numpad0" },
  { r: 5, c: 84, w: 4, rs: 1, label: ".",     code: "NumpadDecimal" },

  /* ---- 主键区 · 数字行（r2） ---- */
  { r: 2, c: 1,  w: 4, rs: 1, label: "`",     code: "Backquote" },
  { r: 2, c: 5,  w: 4, rs: 1, label: "1",     code: "Digit1" },
  { r: 2, c: 9,  w: 4, rs: 1, label: "2",     code: "Digit2" },
  { r: 2, c: 13, w: 4, rs: 1, label: "3",     code: "Digit3" },
  { r: 2, c: 17, w: 4, rs: 1, label: "4",     code: "Digit4" },
  { r: 2, c: 21, w: 4, rs: 1, label: "5",     code: "Digit5" },
  { r: 2, c: 25, w: 4, rs: 1, label: "6",     code: "Digit6" },
  { r: 2, c: 29, w: 4, rs: 1, label: "7",     code: "Digit7" },
  { r: 2, c: 33, w: 4, rs: 1, label: "8",     code: "Digit8" },
  { r: 2, c: 37, w: 4, rs: 1, label: "9",     code: "Digit9" },
  { r: 2, c: 41, w: 4, rs: 1, label: "0",     code: "Digit0" },
  { r: 2, c: 45, w: 4, rs: 1, label: "-",     code: "Minus" },
  { r: 2, c: 49, w: 4, rs: 1, label: "=",     code: "Equal" },
  { r: 2, c: 53, w: 8, rs: 1, label: "⌫",     code: "Backspace" },

  /* ---- 主键区 · QWERTY 行（r3） ---- */
  { r: 3, c: 1,  w: 6, rs: 1, label: "Tab",   code: "Tab" },
  { r: 3, c: 7,  w: 4, rs: 1, label: "Q",     code: "KeyQ" },
  { r: 3, c: 11, w: 4, rs: 1, label: "W",     code: "KeyW" },
  { r: 3, c: 15, w: 4, rs: 1, label: "E",     code: "KeyE" },
  { r: 3, c: 19, w: 4, rs: 1, label: "R",     code: "KeyR" },
  { r: 3, c: 23, w: 4, rs: 1, label: "T",     code: "KeyT" },
  { r: 3, c: 27, w: 4, rs: 1, label: "Y",     code: "KeyY" },
  { r: 3, c: 31, w: 4, rs: 1, label: "U",     code: "KeyU" },
  { r: 3, c: 35, w: 4, rs: 1, label: "I",     code: "KeyI" },
  { r: 3, c: 39, w: 4, rs: 1, label: "O",     code: "KeyO" },
  { r: 3, c: 43, w: 4, rs: 1, label: "P",     code: "KeyP" },
  { r: 3, c: 47, w: 4, rs: 1, label: "[",     code: "BracketLeft" },
  { r: 3, c: 51, w: 4, rs: 1, label: "]",     code: "BracketRight" },
  { r: 3, c: 55, w: 6, rs: 1, label: "\\",    code: "Backslash" },

  /* ---- 主键区 · _home 行（r4） ---- */
  { r: 4, c: 1,  w: 7, rs: 1, label: "Caps",  code: "CapsLock" },
  { r: 4, c: 8,  w: 4, rs: 1, label: "A",     code: "KeyA" },
  { r: 4, c: 12, w: 4, rs: 1, label: "S",     code: "KeyS" },
  { r: 4, c: 16, w: 4, rs: 1, label: "D",     code: "KeyD" },
  { r: 4, c: 20, w: 4, rs: 1, label: "F",     code: "KeyF" },
  { r: 4, c: 24, w: 4, rs: 1, label: "G",     code: "KeyG" },
  { r: 4, c: 28, w: 4, rs: 1, label: "H",     code: "KeyH" },
  { r: 4, c: 32, w: 4, rs: 1, label: "J",     code: "KeyJ" },
  { r: 4, c: 36, w: 4, rs: 1, label: "K",     code: "KeyK" },
  { r: 4, c: 40, w: 4, rs: 1, label: "L",     code: "KeyL" },
  { r: 4, c: 44, w: 4, rs: 1, label: ";",     code: "Semicolon" },
  { r: 4, c: 48, w: 4, rs: 1, label: "'",     code: "Quote" },
  { r: 4, c: 52, w: 9, rs: 1, label: "Enter", code: "Enter" },

  /* ---- 方向键（r4-r5） ---- */
  { r: 4, c: 66, w: 4, rs: 1, label: "↑",     code: "ArrowUp" },
  { r: 5, c: 62, w: 4, rs: 1, label: "←",     code: "ArrowLeft" },
  { r: 5, c: 66, w: 4, rs: 1, label: "↓",     code: "ArrowDown" },
  { r: 5, c: 70, w: 4, rs: 1, label: "→",     code: "ArrowRight" },

  /* ---- 主键区 · Shift 行（r5） ---- */
  { r: 5, c: 1,  w: 9,  rs: 1, label: "Shift", code: "ShiftLeft" },
  { r: 5, c: 10, w: 4,  rs: 1, label: "Z",     code: "KeyZ" },
  { r: 5, c: 14, w: 4,  rs: 1, label: "X",     code: "KeyX" },
  { r: 5, c: 18, w: 4,  rs: 1, label: "C",     code: "KeyC" },
  { r: 5, c: 22, w: 4,  rs: 1, label: "V",     code: "KeyV" },
  { r: 5, c: 26, w: 4,  rs: 1, label: "B",     code: "KeyB" },
  { r: 5, c: 30, w: 4,  rs: 1, label: "N",     code: "KeyN" },
  { r: 5, c: 34, w: 4,  rs: 1, label: "M",     code: "KeyM" },
  { r: 5, c: 38, w: 4,  rs: 1, label: ",",     code: "Comma" },
  { r: 5, c: 42, w: 4,  rs: 1, label: ".",     code: "Period" },
  { r: 5, c: 46, w: 4,  rs: 1, label: "/",     code: "Slash" },
  { r: 5, c: 50, w: 11, rs: 1, label: "Shift", code: "ShiftRight" },

  /* ---- 主键区 · 底行（r6） ---- */
  { r: 6, c: 1,  w: 5,  rs: 1, label: "Ctrl",  code: "ControlLeft" },
  { r: 6, c: 6,  w: 5,  rs: 1, label: "Win",   code: "MetaLeft" },
  { r: 6, c: 11, w: 5,  rs: 1, label: "Alt",   code: "AltLeft" },
  { r: 6, c: 16, w: 25, rs: 1, label: "Space", code: "Space" },
  { r: 6, c: 41, w: 5,  rs: 1, label: "Alt",   code: "AltRight" },
  { r: 6, c: 46, w: 5,  rs: 1, label: "Win",   code: "MetaRight" },
  { r: 6, c: 51, w: 5,  rs: 1, label: "Menu",  code: "ContextMenu" },
  { r: 6, c: 56, w: 5,  rs: 1, label: "Ctrl",  code: "ControlRight" }
];
