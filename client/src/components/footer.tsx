import { Link } from "wouter";

const Footer = () => {
  return (
    <footer className="bg-white border-t border-gray-200 py-3">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="mb-2 md:mb-0">
            <Link href="/">
              <span className="text-black font-heading font-bold text-xl cursor-pointer text-center">
                Hi Wake 2.0
              </span>
            </Link>
            <p className="text-gray-500 text-sm mt-0 text-center">
              Premium 2 tower wake park near Adazi, 30 min drive from center of
              Riga.
            </p>
          </div>
          {/**<div className="flex flex-col md:flex-row items-center md:space-x-8">
            <button className="text-gray-600 hover:text-black mb-1 md:mb-0">
              Contact Us
            </button>
          </div>**/}
        </div>
        {/**<div className="mt-2 text-center text-gray-500 text-sm">
          &copy; {new Date().getFullYear()} Hi Wake 2.0 - All rights reserved
        </div>**/}
      </div>
    </footer>
  );
};

export default Footer;
