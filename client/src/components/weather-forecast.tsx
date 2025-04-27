import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { WeatherForecast } from "@shared/schema";
import { getWeatherForecast } from "@/lib/weather";

const WeatherForecastComponent = () => {
  const { data: forecast, isLoading, error } = useQuery({
    queryKey: ['/api/weather'],
    queryFn: getWeatherForecast
  });
  
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <h3 className="text-lg font-heading font-semibold text-gray-800 mb-3">This Week's Weather</h3>
        <div className="flex overflow-x-auto space-x-4 pb-2">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="flex flex-col items-center min-w-[4.5rem]">
              <Skeleton className="h-4 w-12 mb-1" />
              <Skeleton className="h-10 w-10 rounded-full my-1" />
              <Skeleton className="h-4 w-8" />
            </div>
          ))}
        </div>
      </div>
    );
  }
  
  if (error || !forecast || forecast.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <h3 className="text-lg font-heading font-semibold text-gray-800 mb-3">This Week's Weather</h3>
        <p className="text-center text-gray-500">Weather forecast unavailable</p>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-6">
      <h3 className="text-lg font-heading font-semibold text-gray-800 mb-3">This Week's Weather</h3>
      <div className="flex overflow-x-auto space-x-4 pb-2">
        {forecast.map((day, index) => (
          <div key={index} className="flex flex-col items-center min-w-[4.5rem]">
            <span className="text-sm font-medium text-gray-600">{day.dayName}</span>
            <img src={day.icon} alt={day.condition} className="weather-icon my-1 w-10 h-10" />
            <span className="text-sm font-semibold">{day.temperature}°C</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default WeatherForecastComponent;
