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
    </Card>
  );
}