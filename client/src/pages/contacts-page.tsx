import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Phone, Clock, Mail, ExternalLink } from "lucide-react";
import { Separator } from "@/components/ui/separator";

const ContactsPage = () => {
  return (
    <main className="container mx-auto py-6 px-4">
      <h1 className="text-3xl font-bold mb-6">Kontakti / Contacts</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Contact Information */}
        <Card className="shadow-md">
          <CardContent className="pt-6">
            <h2 className="text-xl font-bold mb-4 text-primary">Saziņai / Get in Touch</h2>
            <Separator className="mb-4" />

            <div className="space-y-4">
              <div className="flex items-start">
                <Phone className="h-5 w-5 mr-2 text-primary" />
                <div>
                  <h3 className="font-medium">Telefons / Phone</h3>
                  <a 
                    href="tel:+37125422219" 
                    className="text-gray-600 hover:text-primary transition-colors"
                  >
                    +371 25 422 219
                  </a>
                </div>
              </div>

              <div className="flex items-start">
                <Mail className="h-5 w-5 mr-2 text-primary" />
                <div>
                  <h3 className="font-medium">E-pasts / Email</h3>
                  <a href="mailto:hiwake2.0@gmail.com" className="text-gray-600 hover:text-primary transition-colors">
                    hiwake2.0@gmail.com
                  </a>
                </div>
              </div>

              <div className="flex items-start">
                <MapPin className="h-5 w-5 mr-2 text-primary" />
                <div>
                  <h3 className="font-medium">Adrese / Address</h3>
                  <p className="text-gray-600">Saulkrasti, Zvejniekciems, Bērzu aleja 7a, LV-2161, Latvija</p>
                </div>
              </div>
              
              <div className="mt-6">
                <h3 className="font-medium mb-3">Sociālie tīkli / Social Media</h3>
                <div className="flex space-x-4">
                  <a 
                    href="https://www.facebook.com/people/HiWake/61576267285909/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center text-gray-600 hover:text-[#1877F2] transition-colors"
                  >
                    <svg className="h-6 w-6 mr-1" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                    <span>Facebook</span>
                  </a>
                  <a 
                    href="https://www.instagram.com/hi_wake2.0" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center text-gray-600 hover:text-[#E1306C] transition-colors"
                  >
                    <svg className="h-6 w-6 mr-1" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
                    </svg>
                    <span>Instagram</span>
                  </a>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Operating Hours */}
        <Card className="shadow-md">
          <CardContent className="pt-6">
            <h2 className="text-xl font-bold mb-4 text-primary">Darba laiks / Working Hours</h2>
            <Separator className="mb-4" />

            <div className="space-y-4">
              <div className="flex items-start">
                <Clock className="h-5 w-5 mr-2 text-primary" />
                <div>
                  <h3 className="font-medium mb-2">Sezonas laikā / During Season</h3>
                  <div className="space-y-1 text-gray-600">
                    <p>Pirmdiena - Piektdiena: 10:00 - 20:00</p>
                    <p>Sestdiena - Svētdiena: 09:00 - 21:00</p>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                <p className="text-sm text-blue-800">
                  Pagaidām strādājam pēc iepriekšēja pieraksta. Online rezrvācija pieejama līdz 1 dienu pirms attiecīgās dienas.
                  <br />
                  Ja online rezervācija nav pieejama, zvaniet uz norādīto tālruni.
                </p>
                <p className="text-sm text-blue-800 mt-2">
                  Currently operating by appointment only. Online reservation is available up to 1 day before the date.
                  <br />
                  If online booking is not available, please call the phone number provided.
                </p>
              </div>
              
              <div className="mt-4">
                <h3 className="font-medium mb-2">Atcelšanas politika / Cancellation Policy</h3>
                <ul className="space-y-1 text-gray-600 text-sm">
                  <li>• Atcelšana mazāk nekā 2 stundas pirms sesijas: jāmaksā pilna cena</li>
                  <li>• Atcelšana mazāk nekā 24 stundas pirms sesijas: jāmaksā 50% no cenas</li>
                  <li>• Ātrāka atcelšana: bez maksas</li>
                </ul>
                <ul className="space-y-1 text-gray-600 text-sm mt-2">
                  <li>• Cancellations less than 2 hours before session: full payment required</li>
                  <li>• Cancellations less than 24 hours before session: 50% payment required</li>
                  <li>• Earlier cancellations: no charge</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Map */}
        <Card className="shadow-md md:col-span-2">
          <CardContent className="pt-6">
            <h2 className="text-xl font-bold mb-4 text-primary">Mūsu atrašanās vieta / Our Location</h2>
            <Separator className="mb-4" />

            <div className="aspect-video relative rounded-lg overflow-hidden border">
              <iframe 
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2166.1990222449!2d24.32753704913578!3d57.13002330002096!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x46eeb65bb9631099%3A0x1898e6eb4452dba7!2sHi%20Wake%202.0!5e0!3m2!1sen!2slv!4v1683123409421!5m2!1sen!2slv" 
                width="100%" 
                height="100%" 
                style={{ border: 0 }} 
                allowFullScreen={true} 
                loading="lazy" 
                referrerPolicy="no-referrer-when-downgrade"
                title="Hi Wake 2.0 Location Map"
                className="absolute inset-0"
              ></iframe>
            </div>

            <div className="mt-4 flex items-center justify-center gap-6">
              <a 
                href="https://www.google.com/maps/place/Hi+Wake+2.0/@57.1300233,24.327537,590m/data=!3m2!1e3!4b1!4m6!3m5!1s0x46eeb65bb9631099:0x1898e6eb4452dba7!8m2!3d57.1300204!4d24.3301119!16s%2Fg%2F11fxf0tdwx" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center text-primary hover:text-primary-dark transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0c-4.198 0-8 3.403-8 7.602 0 4.198 3.469 9.21 8 16.398 4.531-7.188 8-12.2 8-16.398 0-4.199-3.801-7.602-8-7.602zm0 11c-1.657 0-3-1.343-3-3s1.343-3 3-3 3 1.343 3 3-1.343 3-3 3z" />
                </svg>
                <span>Google Maps</span>
              </a>

              <a 
                href="https://www.waze.com/ul?ll=57.1300204%2C24.3301119&navigate=yes&zoom=17" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center text-blue-500 hover:text-blue-700 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.054 0h-16.108c-2.169 0-3.946 1.777-3.946 3.946v16.108c0 2.169 1.777 3.946 3.946 3.946h16.108c2.169 0 3.946-1.777 3.946-3.946v-16.108c0-2.169-1.777-3.946-3.946-3.946zm-8.054 19c-4.418 0-8-3.582-8-8s3.582-8 8-8 8 3.582 8 8-3.582 8-8 8zm-4.908-8.478c-.936.028-1.09-.484-1.089-.921.002-.435.154-.949 1.133-.947.976.002 1.051.482 1.049.92-.002.437-.159.947-1.093.948zm6.979-.042c-1.763 0-3.241 1.441-3.241 3.158s1.478 3.158 3.241 3.158c1.762 0 3.24-1.441 3.24-3.158s-1.478-3.158-3.24-3.158zm2.822-3.941c-1.1-.004-1.073-1.1-1.069-1.474.004-.374.179-1.438 1.241-1.432 1.063.005 1.032 1.068 1.028 1.446-.004.378-.101 1.465-1.2 1.46zm-5.962.046c-1.134-.04-1.039-1.159-.992-1.52.047-.36.321-1.385 1.415-1.345 1.094.04.997 1.12.953 1.485-.044.366-.243 1.42-1.376 1.38zm.834-3.559c-1.587-.058-1.453-1.621-1.388-2.124.064-.504.45-1.937 1.977-1.877 1.526.06 1.394 1.563 1.333 2.074-.062.512-.339 1.985-1.922 1.927z" />
                </svg>
                <span>Waze</span>
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
};

export default ContactsPage;