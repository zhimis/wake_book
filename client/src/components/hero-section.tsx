import WeatherForecast from "./weather-forecast";

const HeroSection = () => {
  return (
    <section className="mb-8">
      <div className="rounded-xl overflow-hidden shadow-lg mb-6 relative">
        <div className="w-full h-48 md:h-64 bg-primary relative">
          <svg xmlns="http://www.w3.org/2000/svg" className="absolute inset-0 w-full h-full text-white opacity-5" viewBox="0 0 800 800">
            <path d="M769 229L1037 260.9M927 880L731 737 520 660 309 538 40 599 295 764 126.5 879.5 40 599-197 493 102 382-31 229 126.5 79.5-69-63" strokeWidth="100" stroke="currentColor" fill="none" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
            <h1 className="text-3xl md:text-4xl font-bold mb-2 text-center px-4">Experience the Thrill</h1>
            <p className="text-lg md:text-xl opacity-90 text-center px-4">Book your perfect wakeboarding session today</p>
          </div>
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black opacity-20"></div>
      </div>
      
      <h2 className="text-3xl font-heading font-bold text-gray-800 mb-3">Book Your Wakeboarding Session</h2>
      <p className="text-gray-600 mb-4">Select your perfect time slot and hit the water at our 2-tower wakeboarding park.</p>
      
      {/* Weather forecast integration */}
      <WeatherForecast />
    </section>
  );
};

export default HeroSection;
