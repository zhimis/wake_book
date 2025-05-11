import { Facebook, Instagram, Mail, Phone } from "lucide-react";
import { Link } from "wouter";

const Footer = () => {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="bg-gray-100 border-t py-6 mt-auto">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="mb-4 md:mb-0">
            <p className="text-gray-600 text-sm">
              © {currentYear} Hi Wake 2.0. Visas tiesības aizsargātas.
            </p>
            <div className="flex flex-col sm:flex-row sm:space-x-4">
              <a 
                href="mailto:hiwake2.0@gmail.com" 
                className="text-gray-600 hover:text-primary transition-colors text-sm flex items-center mt-1"
                aria-label="Email"
              >
                <Mail className="h-3.5 w-3.5 mr-1" />
                <span>hiwake2.0@gmail.com</span>
              </a>
              <a 
                href="tel:+37125422219" 
                className="text-gray-600 hover:text-primary transition-colors text-sm flex items-center mt-1"
                aria-label="Phone"
              >
                <Phone className="h-3.5 w-3.5 mr-1" />
                <span>+371 25 422 219</span>
              </a>
            </div>
          </div>
          
          <div className="flex items-center space-x-6">
            <Link href="/contacts" className="text-gray-600 hover:text-primary transition-colors text-sm">
                Kontakti
            </Link>
            <Link href="/prices" className="text-gray-600 hover:text-primary transition-colors text-sm">
                Cenas
            </Link>
            <a 
              href="https://www.facebook.com/people/HiWake/61576267285909/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-gray-600 hover:text-[#1877F2] transition-colors"
              aria-label="Facebook"
            >
              <Facebook className="h-5 w-5" />
            </a>
            <a 
              href="https://www.instagram.com/hi_wake2.0" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-gray-600 hover:text-[#E1306C] transition-colors"
              aria-label="Instagram"
            >
              <Instagram className="h-5 w-5" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;