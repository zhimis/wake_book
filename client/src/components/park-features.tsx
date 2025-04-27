import { Card, CardContent } from "@/components/ui/card";

const ParkFeatures = () => {
  return (
    <section className="mb-8">
      <h3 className="text-2xl font-heading font-semibold text-gray-800 mb-4">Park Features</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="overflow-hidden">
          <div className="w-full h-48 bg-secondary relative">
            <svg xmlns="http://www.w3.org/2000/svg" className="absolute inset-0 h-full w-full text-white opacity-20" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M12 1.586l-4 4v12.828l4-4V1.586zM3.707 3.293A1 1 0 002 4v10a1 1 0 00.293.707L6 18.414V5.586L3.707 3.293zM17.707 5.293L14 1.586v12.828l2.293 2.293A1 1 0 0018 16V6a1 1 0 00-.293-.707z" clipRule="evenodd" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <h3 className="text-white text-xl font-bold drop-shadow-md">2-Tower System</h3>
            </div>
          </div>
          <CardContent className="p-4">
            <p className="text-gray-600 text-sm">Our professional 2-tower cable system provides the perfect ride for beginners and experts alike. Enjoy smooth pulls and consistent speed across our lake.</p>
          </CardContent>
        </Card>
        
        <Card className="overflow-hidden">
          <div className="w-full h-48 bg-primary relative">
            <svg xmlns="http://www.w3.org/2000/svg" className="absolute inset-0 h-full w-full text-white opacity-20" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 2a4 4 0 00-4 4v1H5a1 1 0 00-.994.89l-1 9A1 1 0 004 18h12a1 1 0 00.994-1.11l-1-9A1 1 0 0015 7h-1V6a4 4 0 00-4-4zm2 5V6a2 2 0 10-4 0v1h4zm-6 3a1 1 0 112 0 1 1 0 01-2 0zm7-1a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <h3 className="text-white text-xl font-bold drop-shadow-md">Equipment Rental</h3>
            </div>
          </div>
          <CardContent className="p-4">
            <p className="text-gray-600 text-sm">Full range of boards, vests, and helmets available for rental or bring your own gear. Our equipment is regularly maintained and suitable for all skill levels.</p>
          </CardContent>
        </Card>
        
        <Card className="overflow-hidden">
          <div className="w-full h-48 bg-accent relative">
            <svg xmlns="http://www.w3.org/2000/svg" className="absolute inset-0 h-full w-full text-white opacity-20" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <h3 className="text-white text-xl font-bold drop-shadow-md">Lakeside Facilities</h3>
            </div>
          </div>
          <CardContent className="p-4">
            <p className="text-gray-600 text-sm">Relax at our beach area with changing rooms, lockers, and a lakeside café. Plenty of space to watch the action or prepare for your session in comfort.</p>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};

export default ParkFeatures;
