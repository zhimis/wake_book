import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sun, CloudRain, Cloud } from "lucide-react";

interface WeatherData {
  location: string;
  current: {
    temperature: number;
    condition: string;
    icon: string;
  };
  forecast: Array<{
    date: string;
    day_name: string;
    temperature: number;
    condition: string;
    icon: string;
  }>;
}

export default function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/weather");
        if (!response.ok) {
          throw new Error("Failed to fetch weather data");
        }
        const data = await response.json();
        setWeather(data);
      } catch (err) {
        console.error("Error fetching weather:", err);
        setError("Could not load weather data");
      } finally {
        setLoading(false);
      }
    };

    fetchWeather();
  }, []);

  const getWeatherIcon = (condition: string) => {
    if (!condition) return <Sun className="h-6 w-6 text-yellow-500" />;
    
    condition = condition.toLowerCase();
    
    if (condition.includes("rain")) {
      return <CloudRain className="h-6 w-6 text-blue-500" />;
    } else if (condition.includes("cloud")) {
      return <Cloud className="h-6 w-6 text-gray-500" />;
    } else {
      return <Sun className="h-6 w-6 text-yellow-500" />;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xl">Loading Weather...</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse flex flex-col items-center py-4">
            <div className="h-8 w-16 bg-gray-300 rounded mb-2"></div>
            <div className="h-4 w-24 bg-gray-300 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !weather) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xl">Weather</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-red-500">
            {error || "Unable to load weather data"}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xl flex items-center">
          {getWeatherIcon(weather.current.condition)}
          <span className="ml-2">Riga Weather</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center py-2">
          <div className="flex items-center justify-center mb-2">
            {weather.current.icon && (
              <img 
                src={weather.current.icon} 
                alt={weather.current.condition} 
                className="w-10 h-10 mr-2" 
              />
            )}
            <p className="text-3xl font-bold">{weather.current.temperature}°C</p>
          </div>
          <p>{weather.current.condition}</p>
          <p className="text-sm text-muted-foreground mt-2">Today's forecast for {weather.location}</p>
        </div>
        
        {weather.forecast && weather.forecast.length > 0 && (
          <div className="mt-4 border-t pt-4">
            <h4 className="text-sm font-medium mb-2">Next Days</h4>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {weather.forecast.slice(1, 4).map((day, index) => (
                <div key={index} className="text-center">
                  <p className="font-medium">{day.day_name}</p>
                  <img 
                    src={day.icon} 
                    alt={day.condition} 
                    className="w-8 h-8 mx-auto" 
                  />
                  <p>{day.temperature}°C</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}