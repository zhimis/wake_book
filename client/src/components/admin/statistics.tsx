import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { StatsData } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice } from "@/lib/utils";

// Component to show a bar chart with percentages
const BarChart = ({ data }: { data: { key: string; value: number; count?: number }[] }) => {
  // If no data has values, show a message
  if (data.every(item => item.value === 0)) {
    return (
      <div className="h-64 flex items-center justify-center">
        <p className="text-gray-500">No booking data available for this period</p>
      </div>
    );
  }
  
  // Calculate the max value to create relative heights
  const maxValue = Math.max(...data.map(item => item.value), 0.01); // Avoid division by zero
  
  // Calculate proportional height for each bar (max height 70% of container)
  const getBarHeight = (value: number) => {
    if (value === 0) return 0;
    // Use a more dramatic scale to make differences more visible
    // Values will range from 10% to 70% height based on their proportion to max
    const proportion = value / maxValue;
    const minHeight = 10; // Minimum height for non-zero values
    return minHeight + proportion * (70 - minHeight);
  };
  
  return (
    <div className="h-64 flex items-end space-x-2 pt-4 pb-8 mt-8">
      {data.map((item) => (
        <div key={item.key} className="flex flex-col items-center flex-1 relative">
          {/* Add the value and count above the bar */}
          <div className="text-xs text-gray-500 absolute -top-8 text-center w-full">
            <span className="font-medium">{item.value.toFixed(1)}%</span>
            {item.count !== undefined && (
              <div className="text-[10px] text-gray-400">({item.count || 0})</div>
            )}
          </div>
          {item.value > 0 ? (
            <div
              className="bg-primary w-full rounded-t-sm transition-all duration-300"
              style={{ height: `${getBarHeight(item.value)}%` }}
            ></div>
          ) : (
            <div className="w-full h-1 bg-gray-200 rounded-sm"></div>
          )}
          <span className="text-xs font-medium mt-1">{item.key}</span>
        </div>
      ))}
    </div>
  );
};

// Component to show horizontal bar stats
const HorizontalBar = ({ 
  label, 
  value, 
  percentage, 
  count
}: { 
  label: string; 
  value: string; 
  percentage: number;
  count?: number 
}) => {
  return (
    <div className="flex items-center">
      <span className="text-sm font-medium w-28">{label}</span>
      <div className="flex-1 h-5 bg-gray-100 rounded-full">
        <div
          className="bg-primary h-5 rounded-full transition-all duration-300 flex items-center justify-end pr-2"
          style={{ width: `${Math.max(percentage, 5)}%` }}
        >
          {percentage >= 15 && (
            <span className="text-xs text-white font-medium">{count || ''}</span>
          )}
        </div>
      </div>
      <span className="text-sm font-medium ml-3 w-14">{value}</span>
    </div>
  );
};

const AdminStatistics = () => {
  const [statsPeriod, setStatsPeriod] = useState("week");

  // Fetch statistics
  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/stats', statsPeriod],
    queryFn: async () => {
      const res = await fetch(`/api/stats?period=${statsPeriod}`);
      if (!res.ok) throw new Error('Failed to fetch statistics');
      return res.json();
    }
  });

  // For CSV export
  const exportToCsv = () => {
    if (!data) return;

    // Create CSV data
    const headers = ['Metric', 'Value'];
    const rows = [
      ['Booking Rate', `${data.bookingRate.toFixed(1)}%`],
      ['Total Bookings', data.totalBookings],
      ['Forecasted Income', formatPrice(data.forecastedIncome)],
      ['Average Session Length', `${data.avgSessionLength.toFixed(0)} minutes`],
    ];

    // Add booking by day data
    data.bookingsByDay.forEach(day => {
      rows.push([`Bookings on ${day.day}`, day.count]);
    });

    // Add popular time slots data
    data.popularTimeSlots.forEach(slot => {
      rows.push([`Popularity of ${slot.time}`, `${slot.percentage.toFixed(1)}%`]);
    });

    // Convert to CSV string
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `wakebook_stats_${statsPeriod}_${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-32 ml-2" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-4 text-destructive text-center">
        Error loading statistics data. Please try again.
      </div>
    );
  }

  // Format data for bar chart
  const bookingByDayData = data.bookingsByDay.map(day => ({
    key: day.day,
    value: day.percentage,
    count: day.count
  }));

  return (
    <div id="statisticsTab" className="admin-tab-content p-4 space-y-6">
      {/* Time Period Selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-gray-700">View stats for:</span>
          <Select
            value={statsPeriod}
            onValueChange={setStatsPeriod}
          >
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="flex items-center gap-1"
          onClick={exportToCsv}
        >
          <Download className="h-4 w-4" />
          Export Data (CSV)
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <h4 className="text-sm font-medium text-gray-500 mb-1">Booking Rate</h4>
            <div className="flex items-baseline">
              <span className="text-2xl font-bold text-gray-800">{data.bookingRate.toFixed(1)}%</span>
            </div>
            <div className="mt-2 h-1 w-full bg-gray-200 rounded-full">
              <div
                className="bg-primary h-1 rounded-full"
                style={{ width: `${data.bookingRate}%` }}
              ></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <h4 className="text-sm font-medium text-gray-500 mb-1">Total Bookings</h4>
            <div className="flex items-baseline">
              <span className="text-2xl font-bold text-gray-800">{data.totalBookings}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <h4 className="text-sm font-medium text-gray-500 mb-1">Forecasted Income</h4>
            <div className="flex items-baseline">
              <span className="text-2xl font-bold text-gray-800">{formatPrice(data.forecastedIncome)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <h4 className="text-sm font-medium text-gray-500 mb-1">Avg. Session Length</h4>
            <div className="flex items-baseline">
              <span className="text-2xl font-bold text-gray-800">{data.avgSessionLength.toFixed(0)} min</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Booking Distribution Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Booking Distribution by Day</CardTitle>
          <CardDescription>
            Distribution of booked time slots across days of the week (percentage of total booked slots)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BarChart data={bookingByDayData} />
        </CardContent>
      </Card>

      {/* Popular Time Slots */}
      <Card>
        <CardHeader>
          <CardTitle>Popular Time Slots</CardTitle>
          <CardDescription>
            Most frequently booked time slots by hour (with booking count and percentage)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.popularTimeSlots.length > 0 ? (
            data.popularTimeSlots.map((slot, index) => (
              <HorizontalBar
                key={index}
                label={slot.time}
                value={`${slot.percentage.toFixed(0)}%`}
                percentage={slot.percentage}
                count={slot.count}
              />
            ))
          ) : (
            <div className="text-center py-4 text-gray-500">
              No time slot data available for this period
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminStatistics;
