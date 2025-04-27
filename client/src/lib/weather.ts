import { WeatherForecast } from "@shared/schema";

export async function getWeatherForecast(): Promise<WeatherForecast[]> {
  try {
    const response = await fetch('/api/weather');
    
    if (!response.ok) {
      throw new Error('Failed to fetch weather data');
    }
    
    const data = await response.json();
    
    return data.forecast.map((day: any) => ({
      date: new Date(day.date),
      dayName: day.day_name,
      temperature: day.temperature,
      condition: day.condition,
      icon: day.icon
    }));
  } catch (error) {
    console.error('Error fetching weather data:', error);
    return [];
  }
}
