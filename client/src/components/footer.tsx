import { Facebook, Instagram } from "lucide-react";
import { Link } from "wouter";

const Footer = () => {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="bg-gray-100 border-t py-6 mt-auto">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="mb-4 md:mb-0">
            <p className="text-gray-600 text-sm">
              © {currentYear} Hi Wake. Visas tiesības aizsargātas.
            </p>
          </div>
          
          <div className="flex items-center space-x-6">
            <Link href="/contacts">
              <a className="text-gray-600 hover:text-primary transition-colors text-sm">
                Kontakti
              </a>
            </Link>
            <Link href="/prices">
              <a className="text-gray-600 hover:text-primary transition-colors text-sm">
                Cenas
              </a>
            </Link>
            <a 
              href="https://www.facebook.com/hiwake.lv" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-gray-600 hover:text-[#1877F2] transition-colors"
              aria-label="Facebook"
            >
              <Facebook className="h-5 w-5" />
            </a>
            <a 
              href="https://www.instagram.com/hiwake.lv" 
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