# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

--------------------
# Thai Music Editor (TME) 🎵

แอปพลิเคชันสำหรับสร้าง แก้ไข และจัดการโน้ตดนตรีไทย (Thai Music Notation) ออกแบบมาเพื่อการเรียนรู้ การสอน และการสร้างสรรค์สำหรับนักดนตรีไทยโดยเฉพาะ รองรับการใช้งานแบบ Cross-platform ทั้งบนคอมพิวเตอร์และโทรศัพท์มือถือ

## 💻 Tech Stack
* **Frontend:** React (Vite)
* **Styling:** Tailwind CSS
* **Database & Authentication:** Firebase (ปรับโครงสร้างเป็น Firebase ล้วนเพื่อความเรียบง่ายและจัดการง่าย)
* **Hosting:** Vercel

## ✨ ฟีเจอร์ปัจจุบัน (Current Features)
* **Authentication:** ระบบเข้าสู่ระบบ/ออกจากระบบ ผ่าน Firebase Auth
* **Responsive Layout:** โครงสร้างหลักสำหรับหน้าจอคอมพิวเตอร์ (`DesktopLayout`) และมือถือ (`MobileLayout`)
* **Routing:** ระบบเปลี่ยนหน้าแบบ Single Page Application (SPA)
* **Global Settings & Modal:** ระบบตั้งค่าโปรเจกต์และหน้ากระดาษในรูปแบบ Popup Modal 
* **Modular State Management:** ใช้ `MusicContext` เป็นศูนย์บัญชาการ โดยแยกตรรกะการทำงานที่ซับซ้อนออกเป็น Custom Hooks (`useSheetEditor`, `useAudioPlayback`)
* **High-Performance Audio Engine:** ระบบเล่นเสียงที่มีความหน่วงต่ำ (Low Latency) ทำงานผ่าน Web Audio API พร้อม Metronome อัจฉริยะที่ซิงค์จังหวะตรงกับทำนองหลัก 100%

## 📂 โครงสร้างไฟล์ทั้งหมด (Full Directory Structure)

```text
THAI-MUSIC-EDITOR/
├── node_modules/                   # โฟลเดอร์เก็บไลบรารีของ npm
├── public/                         # ไฟล์สาธารณะและทรัพยากรคงที่
│   ├── sounds/                     # 🎵 คลังเสียงแยกตามเครื่องดนตรี
│   │   ├── ching/
│   │   ├── khong-wong-lek/
│   │   ├── khong-wong-yai/
│   │   ├── klong-khaek/
│   │   ├── ranat-ek/
│   │   └── ranat-tum/
│   ├── favicon.svg
│   ├── icons.svg
│   ├── logo.png
│   └── logo2.png
├── src/                            # โฟลเดอร์หลักสำหรับ Source Code
│   ├── assets/                     # รูปภาพและทรัพยากรอื่นๆ ในโค้ด
│   ├── components/                 # ชิ้นส่วน UI (Components)
│   │   ├── editor/                 # 🎹 หน้าต่างเขียนโน้ตหลัก
│   │   │   ├── sidebar/            # แถบเมนูย่อยด้านข้าง (KroTab, LabelsTab, VelocityTab ฯลฯ)
│   │   │   │   ├── EditorSidebar.jsx
│   │   │   │   ├── KroTab.jsx
│   │   │   │   ├── LabelsTab.jsx
│   │   │   │   ├── SabatTab.jsx
│   │   │   │   ├── SequenceTab.jsx
│   │   │   │   ├── TableTab.jsx
│   │   │   │   └── VelocityTab.jsx
│   │   │   ├── Keyboard.jsx
│   │   │   ├── MetronomePanel.jsx
│   │   │   ├── PlaybackControls.jsx
│   │   │   ├── SettingsModal.jsx
│   │   │   └── Sheet.jsx
│   │   ├── landing/                # 🛬 ส่วนประกอบของหน้าต่างต้อนรับ (Landing Page)
│   │   │   ├── CtaSection.jsx
│   │   │   ├── FeaturesSection.jsx
│   │   │   ├── Footer.jsx
│   │   │   ├── GuideSection.jsx
│   │   │   ├── HeroSection.jsx
│   │   │   └── Navbar.jsx
│   │   ├── layout/                 # 🖥️ โครงสร้างหน้าจอคอมพิวเตอร์
│   │   │   ├── DesktopLayout.jsx
│   │   │   ├── MainSidebar.jsx
│   │   │   └── Navbar.jsx
│   │   ├── mobile/                 # 📱 โครงสร้างหน้าจอมือถือ
│   │   │   ├── BottomNav.jsx
│   │   │   ├── MobileLayout.jsx
│   │   │   └── MobileTopBar.jsx
│   │   └── tools/                  # 🛠️ เครื่องมือพิเศษและหน้าแอดมิน
│   │       ├── tool-workspace/     # พื้นที่ทำงานจำเพาะของเครื่องมือ
│   │       │   ├── Timeline.jsx
│   │       │   ├── Toolbar.jsx
│   │       │   ├── TopBar.jsx
│   │       │   └── TrackPanel.jsx
│   │       ├── AdminUpdateForm.jsx
│   │       ├── RanatDictionary.jsx
│   │       ├── RanatGenerator.jsx
│   │       ├── RhythmManager.jsx
│   │       ├── ToolWorkspace.jsx
│   │       └── TunerDashboard.jsx
│   ├── contexts/                   # 🧠 ศูนย์บัญชาการข้อมูล (Context API)
│   │   ├── MusicContext.jsx        # แจกจ่าย State โน้ตเพลงและระบบเสียง
│   │   └── WorkspaceContext.jsx    # แจกจ่าย State สำหรับ Workspace เครื่องมือ
│   ├── hooks/                      # ⚙️ Custom Hooks (ตรรกะการทำงาน)
│   │   ├── useAudioPlayback.js     # ควบคุมเสียง, ซิงค์จังหวะ Metronome, แถบ Cursor
│   │   ├── useDevice.js            # ตรวจจับขนาดหน้าจอ (Desktop/Mobile)
│   │   └── useSheetEditor.js       # ควบคุมการพิมพ์โน้ต, สร้าง/ลบบรรทัด, Undo/Redo
│   ├── pages/                      # 📄 หน้าเพจของแอปพลิเคชัน
│   │   ├── AdminDashboard.jsx
│   │   ├── Home.jsx
│   │   ├── Landing.jsx
│   │   ├── Login.jsx
│   │   ├── MyProjects.jsx
│   │   ├── Samples.jsx
│   │   ├── Settings.jsx
│   │   ├── Templates.jsx
│   │   └── Tools.jsx
│   ├── utils/                      # 🧰 ฟังก์ชันอรรถประโยชน์
│   │   ├── audioEngine.js          # เอนจินประมวลผลเสียง Web Audio API
│   │   ├── firebase.js             # ตั้งค่าฐานข้อมูล Firebase
│   │   ├── instrumentConfig.js     # ค่าพารามิเตอร์ของเครื่องดนตรีต่างๆ
│   │   └── sheetUtils.js           # ฟังก์ชันคำนวณคณิตศาสตร์สำหรับจัดหน้าโน้ต
│   ├── views/                      # 👁️ มุมมองครอบคลุม Component ใหญ่
│   │   ├── DesktopEditor.jsx
│   │   └── MobileEditor.jsx
│   ├── App.css                     # สไตล์เพิ่มเติม
│   ├── App.jsx                     # Component หลัก จัดการ Routing
│   ├── index.css                   # สไตล์หลักระดับโกลบอล (Tailwind)
│   └── main.jsx                    # จุดเริ่มต้นการรัน React (Entry Point)
├── .gitignore                      # กำหนดไฟล์ที่ไม่ต้องนำขึ้น Git
├── eslint.config.js                # ตั้งค่า Linter สำหรับตรวจสอบโค้ด
├── index.html                      # หน้า HTML เปล่าพื้นฐานของโปรเจกต์
├── package-lock.json               # บันทึกเวอร์ชันที่แน่นอนของไลบรารี
├── package.json                    # รายชื่อไลบรารีที่ใช้ในโปรเจกต์
├── postcss.config.js               # ตั้งค่า PostCSS (ใช้ร่วมกับ Tailwind)
├── README.md                       # ไฟล์อธิบายโปรเจกต์
├── repomix-output.xml              # ข้อมูล Export ของโปรเจกต์
├── src.rar                         # ไฟล์บีบอัด Source Code
├── tailwind.config.js              # ตั้งค่าคลาสและธีมสีของ Tailwind CSS
├── vercel.json                     # ตั้งค่า Routing สำหรับ Vercel Hosting
└── vite.config.js                  # ตั้งค่าระบบการ Build ของ Vite