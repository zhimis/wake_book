import { Card, CardContent } from "@/components/ui/card";
import BookingCalendar from "@/components/booking-calendar";

const HomePage = () => {
  return (
    <main className="container mx-auto px-0.5 py-0">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="md:col-span-4">
            <BookingCalendar />
          </div>

          <div className="w-full">
            <div>
              <Card>
                <CardContent className="pt-2 px-2">
                  <h3 className="text-lg font-semibold mb-2">
                    Kontaktinformācija
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <h4 className="font-medium text-sm">Darba laiks</h4>
                      <p className="text-gray-600 text-xs">
                        Pagaidām strādājam pēc iepriekšēja pieraksta. Online
                        rezrvācija pieejama līdz 1 dienu pirms attiecīgās
                        dienas.
                        <br /> Ja online rezervācija nav pieejama, zvaniet uz
                        norādīto tālruni.
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium text-sm">Kontakti</h4>
                      <p className="text-gray-600 text-xs">
                        Telefons: +371 25 422 219
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium text-sm">Cenas:</h4>
                      <p className="text-gray-600 text-xs">
                        Pavasarā/Off-peak: 20 eur / pusstundu <br />
                        Vasarā/Peak: 25 eur / pusstundu <br />
                        Hidras noma: 7 eur /stundu (5 eur / pusstundu)
                        <br />
                        Dēļa noma: 10 eur / stundu (7 eur / pusstundu)
                        <br />
                        Pirts + kabelis + ekipējums: 60 eur / stundu.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="mt-2 p-2 bg-blue-50 rounded-lg border border-blue-100">
              <h4 className="text-blue-800 font-medium text-sm mb-1">
                Booking Instructions
              </h4>
              <ul className="text-blue-700 text-xs space-y-1">
                <li>• Select consecutive time slots</li>
                <li>• Prices vary by time and weekends</li>
                <li>• Green slots are available</li>
                <li>• Yellow slots are booked</li>
                <li>• Red slots are blocked</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};

export default HomePage;
