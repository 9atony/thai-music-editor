# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

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
* **Responsive Layout:**
  * `DesktopLayout`: โครงสร้างหลักสำหรับหน้าจอคอมพิวเตอร์ (เมนูด้านซ้าย)
  * `MobileLayout`: มี Bottom Navigation สำหรับการทัชบนมือถือ
* **Routing:** ระบบเปลี่ยนหน้าแบบ Single Page Application (SPA) จัดการผ่าน State (`currentView`) 
* **Global Settings & Modal:** ระบบตั้งค่าโปรเจกต์และหน้ากระดาษในรูปแบบ Popup Modal (เรียกผ่านปุ่มตั้งค่าที่ Navbar เพื่อความสะอาดและกว้างขวางของพื้นที่ทำงาน)
* **Global State Management:** ใช้ `MusicContext` เป็นสมองกลางของแอปพลิเคชัน คอยควบคุมระบบเสียง, ประวัติ (Undo/Redo), และข้อมูลโน้ตทั้งหมด
* **Vercel Deployment:** รองรับการทำ Redirect โฮสติ้งด้วยไฟล์ `vercel.json` ป้องกันปัญหา 404 Not Found

## 📂 โครงสร้างไฟล์หลัก (Directory Structure)

```text
THAI-MUSIC-EDITOR/
├── node_modules/
├── public/
├── src/
│   ├── assets/                     # รูปภาพและโลโก้
│   ├── components/
│   │   ├── controls/               # ส่วนควบคุมการเล่นเสียง
│   │   │   └── PlaybackControls.jsx
│   │   ├── editor/                 # ส่วนประกอบของหน้าต่างเขียนโน้ต
│   │   │   ├── Keyboard.jsx
│   │   │   ├── SettingsModal.jsx   # ⚙️ ป๊อปอัปตั้งค่าโปรเจกต์ (ย้ายมาจาก Sidebar เดิม)
│   │   │   └── Sheet.jsx           # กระดาษโน้ตหลัก
│   │   ├── layout/                 # Layout สำหรับคอมพิวเตอร์
│   │   │   ├── DesktopLayout.jsx   # โครงสร้างหลักฝั่งเดสก์ท็อป (เมนูด้านซ้าย)
│   │   │   ├── MainSidebar.jsx
│   │   │   ├── Navbar.jsx          # แถบเมนูด้านบน (มีปุ่มเปิด Modal ตั้งค่า)
│   │   │   └── Sidebar.jsx         # (ไม่ได้ใช้งานแล้ว / แทนที่ด้วย SettingsModal)
│   │   └── mobile/                 # Layout สำหรับมือถือ
│   │       ├── BottomNav.jsx
│   │       ├── MobileLayout.jsx
│   │       └── MobileTopBar.jsx
│   ├── contexts/
│   │   └── MusicContext.jsx        # 🧠 "สมองกลาง" จัดการ State รวม, ระบบเสียง และข้อมูลเพลงทั้งหมดของแอป
│   ├── hooks/
│   │   ├── useAudio.js             # Hook จัดการระบบเสียง
│   │   └── useDevice.js            # Hook ตรวจจับขนาดหน้าจอ
│   ├── pages/                      # หน้าเพจหลักของแอป
│   │   ├── Home.jsx
│   │   ├── Landing.jsx
│   │   ├── Login.jsx
│   │   ├── MyProjects.jsx
│   │   ├── Samples.jsx             # หน้าตัวอย่างผลงาน/โน้ตดนตรี
│   │   ├── Settings.jsx
│   │   ├── Templates.jsx           # หน้าเทมเพลตสำหรับเริ่มเขียนโน้ต
│   │   └── Tools.jsx               # หน้าเครื่องมือเพิ่มเติม
│   ├── utils/                      # ฟังก์ชันตัวช่วยและตั้งค่าต่างๆ
│   │   ├── audioEngine.js          # เอนจินประมวลผลเสียง
│   │   ├── firebase.js             # ตั้งค่าและฟังก์ชันเชื่อมต่อ Firebase
│   │   └── instrumentConfig.js     # ค่าคอนฟิกสำหรับเครื่องดนตรี
│   ├── views/                      # มุมมองหลัก (View Layer)
│   │   ├── DesktopEditor.jsx       # 🧩 ตัวรวมองค์ประกอบ (Assembly View) สำหรับหน้าจอคอมพิวเตอร์
│   │   └── MobileEditor.jsx        # ตัวรวมองค์ประกอบสำหรับมือถือ
│   ├── App.css
│   ├── App.jsx                     # จุดศูนย์กลางจัดการ Routing
│   ├── index.css                   # สไตล์หลักของแอป
│   └── main.jsx                    # Entry point ของ React
├── .gitignore
├── eslint.config.js
├── index.html
├── package-lock.json
├── package.json
├── postcss.config.js
├── README.md
├── repomix-output.xml
├── tailwind.config.js
├── vercel.json                     # ตั้งค่าการ Routing บน Vercel
└── vite.config.js