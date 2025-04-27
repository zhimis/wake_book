import { useQuery } from "@tanstack/react-query";
import { WeatherForecast } from "@shared/schema";

export function useWeather() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/weather'],
    queryFn: async () => {
      const res = await fetch('/api/weather');
      if (!res.ok) throw new Error('Failed to fetch weather data');
      
      const data = await res.json();
      
      // Map API response to WeatherForecast type
      return data.forecast.map((day: any) => ({
        date: new Date(day.date),
        dayName: day.day_name,
        temperature: day.temperature,
        condition: day.condition,
        icon: day.icon
      }));
    }
  });
  
  return {
    forecast: data as WeatherForecast[] || [],
    isLoading,
    error
  };
}
