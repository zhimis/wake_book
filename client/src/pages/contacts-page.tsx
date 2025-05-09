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
                  <p className="text-gray-600">+371 25 422 219</p>
                </div>
              </div>

              <div className="flex items-start">
                <Mail className="h-5 w-5 mr-2 text-primary" />
                <div>
                  <h3 className="font-medium">E-pasts / Email</h3>
                  <p className="text-gray-600">info@hiwake.lv</p>
                </div>
              </div>

              <div className="flex items-start">
                <MapPin className="h-5 w-5 mr-2 text-primary" />
                <div>
                  <h3 className="font-medium">Adrese / Address</h3>
                  <p className="text-gray-600">Latvija, Ķekavas novads, Baldone, Rīgas iela 119, LV-2125</p>
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
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2177.385935770352!2d24.392731812858646!3d56.74250560469748!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x46e925cf328afda3%3A0xb879f40153d6381a!2zUsSrZ2FzIGllbGEgMTE5LCBCYWxkb25lLCBLxJNrYXZhcyBub3ZhZHMsIExWLTIxMjU!5e0!3m2!1slv!2slv!4v1651123409421!5m2!1slv!2slv" 
                width="100%" 
                height="100%" 
                style={{ border: 0 }} 
                allowFullScreen={true} 
                loading="lazy" 
                referrerPolicy="no-referrer-when-downgrade"
                title="Hi Wake Location Map"
                className="absolute inset-0"
              ></iframe>
            </div>

            <div className="mt-4 flex items-center justify-center">
              <a 
                href="https://goo.gl/maps/T9Z8vXrQ5KM78QZJA" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center text-primary hover:text-primary-dark transition-colors"
              >
                <span className="mr-1">Atvērt Google kartē</span>
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
};

export default ContactsPage;