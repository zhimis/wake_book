import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const PricesPage = () => {
  return (
    <main className="container mx-auto py-6 px-4">
      <h1 className="text-3xl font-bold mb-6">Cenas / Prices</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Wakeboarding Prices */}
        <Card className="shadow-md">
          <CardContent className="pt-6">
            <h2 className="text-xl font-bold mb-4 text-primary">Wakeboarding</h2>
            <Separator className="mb-4" />

            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="font-medium">30 minūtes</span>
                <span className="font-bold">20 / 25 EUR</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">1 stunda</span>
                <span className="font-bold">40 / 50 EUR</span>
              </div>
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 mt-3">
                <p className="text-sm text-blue-800">
                  <span className="font-medium">20 / 40 EUR</span> - Pavasara / Off-peak season (Spring)
                  <br />
                  <span className="font-medium">25 / 50 EUR</span> - Vasaras / Peak season (Summer)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Equipment Rental */}
        <Card className="shadow-md">
          <CardContent className="pt-6">
            <h2 className="text-xl font-bold mb-4 text-primary">Ekipējuma noma / Equipment Rental</h2>
            <Separator className="mb-4" />

            <div className="space-y-3">
              <div>
                <h3 className="font-medium mb-2">Hidrotērps / Wetsuit</h3>
                <div className="flex justify-between pl-4">
                  <span>30 minūtes</span>
                  <span className="font-bold">5 EUR</span>
                </div>
                <div className="flex justify-between pl-4">
                  <span>1 stunda</span>
                  <span className="font-bold">7 EUR</span>
                </div>
              </div>

              <div className="mt-4">
                <h3 className="font-medium mb-2">Dēlis / Board Rental</h3>
                <div className="flex justify-between pl-4">
                  <span>30 minūtes</span>
                  <span className="font-bold">7 EUR</span>
                </div>
                <div className="flex justify-between pl-4">
                  <span>1 stunda</span>
                  <span className="font-bold">10 EUR</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Package Deal */}
        <Card className="shadow-md md:col-span-2">
          <CardContent className="pt-6">
            <h2 className="text-xl font-bold mb-4 text-primary">Pakalpojumu paketes / Packages</h2>
            <Separator className="mb-4" />

            <div className="space-y-3">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                <h3 className="font-semibold text-lg mb-2">Kabelis + Pirts + Ekipējums</h3>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Cable + Sauna + Equipment Rental</p>
                    <p className="text-sm text-gray-600">1 stunda / 1 hour</p>
                  </div>
                  <span className="font-bold text-lg">60 EUR</span>
                </div>
              </div>
            </div>

            <div className="mt-6 bg-gray-50 p-4 rounded-lg">
              <h3 className="font-medium mb-2">Piezīmes / Notes</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                <li>Visas cenas ir norādītas ar PVN / All prices include VAT</li>
                <li>Rezervācija ir nepieciešama / Booking is required</li>
              </ul>
              
              <h3 className="font-medium mt-4 mb-2">Atcelšanas politika / Cancellation Policy</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                <li>Atcelšana mazāk nekā 2 stundas pirms sesijas: jāmaksā pilna cena / Cancellations less than 2 hours before session: full payment required</li>
                <li>Atcelšana mazāk nekā 24 stundas pirms sesijas: jāmaksā 50% no cenas / Cancellations less than 24 hours before session: 50% payment required</li>
                <li>Ātrāka atcelšana: bez maksas / Earlier cancellations: no charge</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
};

export default PricesPage;