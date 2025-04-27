import { Link } from "wouter";

const Footer = () => {
  return (
    <footer className="bg-white border-t border-gray-200 py-6">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="mb-4 md:mb-0">
            <Link href="/">
              <span className="text-primary font-heading font-bold text-xl cursor-pointer">Hi Wake 2.0</span>
            </Link>
            <p className="text-gray-500 text-sm mt-1">Riga, Latvia's premier wakeboarding facility</p>
          </div>
          <div className="flex flex-col md:flex-row items-center md:space-x-8">
            <button className="text-gray-600 hover:text-primary mb-2 md:mb-0">Contact Us</button>
            <button className="text-gray-600 hover:text-primary mb-2 md:mb-0">FAQ</button>
            <button className="text-gray-600 hover:text-primary">Terms & Conditions</button>
          </div>
        </div>
        <div className="mt-6 text-center text-gray-500 text-sm">
          &copy; {new Date().getFullYear()} Hi Wake 2.0 - All rights reserved
        </div>
      </div>
    </footer>
  );
};

export default Footer;
