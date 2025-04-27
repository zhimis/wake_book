import { useQuery } from "@tanstack/react-query";
import { WeatherForecast } from "@shared/schema";

export function useWeather() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/weather'],
    queryFn: async () => {
      const res = await fetch('/api/weather');
      if (!res.ok) throw new Error('Failed to fetch weather data');
      
      const data = await res.json();
      return data;
    }
  });
  
  return {
    forecast: data?.forecast || [],
    isLoading,
    error
  };
}
