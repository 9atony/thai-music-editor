import React from 'react';
import { FileText, Gamepad2, Music, Briefcase, Heart } from 'lucide-react';

const FeaturesSection = () => {
  return (
    // ⭐ เติม id="features" ตรงนี้
    <section id="features" className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 flex items-center justify-center gap-4">
            <span className="text-red-500 text-2xl">•</span>
            <span className="text-blue-500 text-2xl">•</span>
            ครบทุกเครื่องมือสำหรับดนตรีไทย
            <span className="text-blue-500 text-2xl">•</span>
            <span className="text-yellow-500 text-2xl">•</span>
          </h2>
          <p className="text-gray-500">ออกแบบมาเพื่อพัฒนานักเรียน ครู และนักดนตรีไทยโดยเฉพาะ</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6 text-left">
          {/* Card 1 */}
          <div className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-md transition border border-gray-100">
            <div className="w-14 h-14 bg-red-100 text-red-500 rounded-xl flex items-center justify-center mb-6">
              <FileText className="w-7 h-7" />
            </div>
            <h3 className="font-bold text-lg mb-2">เขียนและแก้ไขโน้ต</h3>
            <p className="text-gray-500 text-sm mb-6 leading-relaxed">เครื่องมือเขียนโน้ตที่ครบครัน รองรับเครื่องดนตรีไทยทุกชนิด พร้อมสัญลักษณ์ครบถ้วน</p>
          </div>

          {/* Card 2 */}
          <div className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-md transition border border-gray-100">
            <div className="w-14 h-14 bg-blue-100 text-blue-500 rounded-xl flex items-center justify-center mb-6">
              <Music className="w-7 h-7" />
            </div>
            <h3 className="font-bold text-lg mb-2">ฟังเสียงสมจริง</h3>
            <p className="text-gray-500 text-sm mb-6 leading-relaxed">จำลองเสียงเครื่องดนตรีไทยสมจริง ฟังจังหวะและทำนองได้ทันทีขณะแต่งเพลง</p>
          </div>

          {/* Card 3 */}
          <div className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-md transition border border-gray-100">
            <div className="w-14 h-14 bg-yellow-100 text-yellow-600 rounded-xl flex items-center justify-center mb-6">
              <Gamepad2 className="w-7 h-7" />
            </div>
            <h3 className="font-bold text-lg mb-2">โหมดเล่นตามโน้ต</h3>
            <p className="text-gray-500 text-sm mb-6 leading-relaxed">ฝึกทักษะการตีตามโน้ตด้วยตัววิ่งกวาดสายตาแบบเรียลไทม์ เข้าใจง่าย</p>
          </div>

          {/* Card 4 */}
          <div className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-md transition border border-gray-100">
            <div className="w-14 h-14 bg-purple-100 text-purple-500 rounded-xl flex items-center justify-center mb-6">
              <Briefcase className="w-7 h-7" />
            </div>
            <h3 className="font-bold text-lg mb-2">จัดการโปรเจกต์</h3>
            <p className="text-gray-500 text-sm mb-6 leading-relaxed">บันทึกเพลงของคุณไว้บนคลาวด์ ปลอดภัย และเปิดแก้ไขได้จากทุกอุปกรณ์</p>
          </div>

          {/* Card 5 */}
          <div className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-md transition border border-gray-100">
            <div className="w-14 h-14 bg-green-100 text-green-500 rounded-xl flex items-center justify-center mb-6">
              <Heart className="w-7 h-7" />
            </div>
            <h3 className="font-bold text-lg mb-2">แบ่งปันและส่งออก</h3>
            <p className="text-gray-500 text-sm mb-6 leading-relaxed">ส่งออกไฟล์เป็นรูปภาพ หรือโปรเจกต์ เพื่อส่งต่อให้เพื่อนและนักเรียนได้ทันที</p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;