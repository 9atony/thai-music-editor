import { ExternalLink, Mail } from 'lucide-react';
import { CONTACT_LINKS } from '../../config/contactLinks';

const ContactLinks = () => (
  <ul className="grid gap-3 sm:grid-cols-3">
    {CONTACT_LINKS.map((link) => (
      <li key={link.href}>
        <a href={link.href} target={link.external ? '_blank' : undefined} rel={link.external ? 'noopener noreferrer' : undefined} className="flex h-full items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-4 text-sm font-bold text-blue-700 transition hover:bg-blue-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600">
          {link.label}
          {link.external ? <ExternalLink size={18} className="shrink-0" aria-label="เปิดในแท็บใหม่" /> : <Mail size={18} className="shrink-0" aria-hidden="true" />}
        </a>
      </li>
    ))}
  </ul>
);

export default ContactLinks;
