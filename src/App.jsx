import React, { useRef, useState } from 'react'; // 1. เพิ่ม useState ตรงนี้
import { useReactToPrint } from 'react-to-print';
import Navbar from './components/layout/Navbar';
import Sidebar from './components/layout/Sidebar';
import PlaybackControls from './components/controls/PlaybackControls';
import Keyboard from './components/editor/Keyboard';
import Sheet from './components/editor/Sheet';

function App() {
  // 2. สร้าง State สำหรับควบคุมการเปิด-ปิด Sidebar (ค่าเริ่มต้นคือเปิด: true)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const componentRef = useRef();

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: 'Thai-Music-Note', 
  });

  // 3. ฟังก์ชันสำหรับสลับสถานะเปิด/ปิด
  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <div className="h-screen w-full flex flex-col bg-slate-100 font-sans overflow-hidden">
      
      {/* 4. ส่ง toggleSidebar ไปให้ Navbar เพื่อผูกกับปุ่มแฮมเบอร์เกอร์ */}
      <Navbar onPrint={handlePrint} onToggleSidebar={toggleSidebar} />
      
  

      <div className="flex flex-1 overflow-hidden relative">
        
        {/* 5. ส่งสถานะ isOpen ไปบอก Sidebar ว่าตอนนี้ต้องกางหรือหด */}
        <Sidebar isOpen={isSidebarOpen} />
        
        <main className="flex-1 flex flex-col bg-[#f0f4f8] overflow-hidden transition-all duration-300">
          
          {/* ⭐ แก้ไขตรงนี้: ปรับพื้นที่ตรงกลางให้รองรับหน้ากระดาษที่งอกไปทางขวา */}
          <div className="flex-1 overflow-hidden p-8 flex flex-col items-center">
            <Sheet ref={componentRef} /> 
          </div>

          <Keyboard /> 
          
        </main>

      </div>
    </div>
  );
}

export default App;