import React from 'react';
import { BookOpen, Code2, ExternalLink, HeartHandshake, Info, Music2, PackageCheck, UsersRound } from 'lucide-react';
import Navbar from '../components/landing/Navbar';
import Footer from '../components/landing/Footer';
import { APP_METADATA, DEVELOPER_CONTACTS, THAI_MUSIC_XML_LINKS } from '../config/appMetadata';

const SectionCard = ({ icon: Icon, title, children }) => (
  <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
    <div className="mb-4 flex items-center gap-3">
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">{React.createElement(Icon, { size: 21, 'aria-hidden': true })}</span>
      <h2 className="text-xl font-black tracking-tight text-slate-900 sm:text-2xl">{title}</h2>
    </div>
    <div className="text-sm leading-7 text-slate-600 sm:text-base">{children}</div>
  </section>
);

const About = ({ onLoginClick }) => (
  <div className="min-h-screen overflow-x-hidden bg-slate-50 font-sans text-slate-800">
    <Navbar onLoginClick={onLoginClick} />
    <main className="pt-20" id="main-content">
      <header className="border-b border-blue-100 bg-gradient-to-br from-blue-50 via-white to-sky-50">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="max-w-3xl">
            <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white px-3 py-1.5 text-xs font-bold text-blue-700 shadow-sm"><Info size={14} aria-hidden="true" />ข้อมูลโครงการ</span>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-5xl">เกี่ยวกับ Thai Music Editor</h1>
            <p className="mt-5 text-base leading-8 text-slate-600 sm:text-lg">พื้นที่สำหรับเรียนรู้ สร้างสรรค์ และจัดการโน้ตดนตรีไทยในรูปแบบดิจิทัล</p>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl gap-5 px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <SectionCard icon={Music2} title="เกี่ยวกับ Thai Music Editor">
          <p>Thai Music Editor คือเว็บแอปพลิเคชันสำหรับสร้าง แก้ไข เล่นเสียง และจัดการโน้ตดนตรีไทยในรูปแบบดิจิทัล ออกแบบให้รองรับรูปแบบการเขียนโน้ตและกระบวนการทำงานเฉพาะของดนตรีไทย เพื่อช่วยให้การเรียนรู้ การสร้างสรรค์ และการอนุรักษ์ดนตรีไทยสามารถเข้าถึงได้สะดวกยิ่งขึ้น</p>
        </SectionCard>

        <SectionCard icon={UsersRound} title="ผู้พัฒนา">
          <dl className="grid gap-3 sm:grid-cols-2">
            {DEVELOPER_CONTACTS.map((contact) => <div key={contact.label} className="rounded-2xl bg-slate-50 px-4 py-3"><dt className="text-xs font-bold text-slate-500">{contact.label}</dt><dd className="mt-1 font-bold text-slate-800">{contact.value}</dd></div>)}
          </dl>
        </SectionCard>

        <SectionCard icon={HeartHandshake} title="ผู้สนับสนุนและแหล่งที่มาของเสียง">
          {/* ต้องยืนยันชื่อภาษาไทย ตำแหน่งทางวิชาการ ขอบเขตการอนุญาต และรูปแบบเครดิตกับเจ้าของเสียงก่อนเผยแพร่จริง ห้ามทำลิงก์ดาวน์โหลดหรือเปิดเผยตำแหน่งไฟล์เสียงโดยตรง */}
          <p>เสียงตัวอย่างเครื่องดนตรีไทยที่ใช้ใน Thai Music Editor ได้รับความอนุเคราะห์จาก อาจารย์ Kritidech Aromoon เพื่อใช้ประกอบระบบเล่นเสียงโน้ตภายในเว็บแอปพลิเคชัน ขอขอบพระคุณสำหรับการสนับสนุนทรัพยากรเสียง ซึ่งมีส่วนช่วยให้การสร้างและทดลองบรรเลงโน้ตดนตรีไทยในรูปแบบดิจิทัลมีความสมจริงยิ่งขึ้น</p>
        </SectionCard>

        <SectionCard icon={BookOpen} title="มาตรฐานที่รองรับ">
          <p>Thai Music Editor รองรับการนำเข้าและส่งออกไฟล์ตามมาตรฐาน ThaiMusicXML ซึ่งเป็นรูปแบบไฟล์แบบเปิดสำหรับจัดเก็บและแลกเปลี่ยนข้อมูลโน้ตดนตรีไทยระหว่างซอฟต์แวร์</p>
          <p className="mt-4">ThaiMusicXML พัฒนาโดย <strong className="font-bold text-slate-800">นพรุจ อนันต์วรณิชย์</strong> และเผยแพร่ภายใต้ Apache License 2.0</p>
          <ul className="mt-5 grid gap-2 sm:grid-cols-2">
            {THAI_MUSIC_XML_LINKS.map((link) => <li key={link.href}><a className="inline-flex items-center gap-1.5 font-bold text-blue-600 underline decoration-blue-200 underline-offset-4 transition hover:text-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600" href={link.href} target="_blank" rel="noopener noreferrer">{link.label}<ExternalLink size={14} aria-label="เปิดในแท็บใหม่" /></a></li>)}
          </ul>
          <p className="mt-5 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">การกล่าวถึง ThaiMusicXML ไม่ได้หมายความว่าผู้พัฒนา ThaiMusicXML เป็นผู้รับรอง สนับสนุน หรือรับผิดชอบต่อ Thai Music Editor</p>
        </SectionCard>

        <SectionCard icon={Code2} title="เครดิตและสัญญาอนุญาต">
          <p>Thai Music Editor ใช้มาตรฐานและไลบรารีโอเพนซอร์ส โดยลิขสิทธิ์ของแต่ละโครงการยังเป็นของเจ้าของโครงการนั้น ๆ และต้องคงข้อความลิขสิทธิ์ License และ NOTICE ตามเงื่อนไขที่เกี่ยวข้อง</p>
        </SectionCard>

        <SectionCard icon={PackageCheck} title="ข้อมูลเวอร์ชัน">
          <dl className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-slate-50 px-4 py-3"><dt className="text-xs font-bold text-slate-500">เวอร์ชัน Thai Music Editor</dt><dd className="mt-1 font-black text-slate-800">v{APP_METADATA.version}</dd></div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3"><dt className="text-xs font-bold text-slate-500">ThaiMusicXML ที่รองรับ</dt><dd className="mt-1 font-black text-slate-800">v{APP_METADATA.thaiMusicXmlVersion}</dd></div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3"><dt className="text-xs font-bold text-slate-500">วันที่อัปเดตล่าสุด</dt><dd className="mt-1 font-black text-slate-800">{APP_METADATA.lastUpdated}</dd></div>
          </dl>
        </SectionCard>
      </div>
    </main>
    <Footer />
  </div>
);

export default About;
