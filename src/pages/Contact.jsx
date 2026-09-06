import Navbar from '../components/landing/Navbar';
import Footer from '../components/landing/Footer';
import ContactLinks from '../components/landing/ContactLinks';

const Contact = ({ onLoginClick }) => (
  <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
    <Navbar onLoginClick={onLoginClick} />
    <main id="main-content" className="mx-auto max-w-[1440px] px-4 pb-16 pt-32 sm:px-6 sm:pb-24 lg:px-10">
      <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-5xl">ติดต่อเรา</h1>
      <p className="mt-5 leading-8 text-slate-600">สอบถามการใช้งาน แจ้งปัญหา หรือแลกเปลี่ยนความรู้กับชุมชน Thai Music Editor</p>
      <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="mb-5 text-xl font-black text-slate-900">ติดต่อและคอมมูนิตี้</h2>
        <ContactLinks />
      </section>
    </main>
    <Footer />
  </div>
);

export default Contact;
