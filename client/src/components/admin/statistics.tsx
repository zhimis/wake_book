import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { StatsData } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice } from "@/lib/utils";

// Component to show a bar chart with percentages
const BarChart = ({ data }: { data: { key: string; value: number }[] }) => {
  return (
    <div className="h-64 flex items-end space-x-2">
      {data.map((item) => (
        <div key={item.key} className="flex flex-col items-center flex-1">
          <div
            className="bg-primary w-full rounded-t-sm transition-all duration-300"
            style={{ height: `${item.value}%` }}
          ></div>
          <span className="text-xs font-medium mt-1">{item.key}</span>
        </div>
      ))}
    </div>
  );
};

// Component to show horizontal bar stats
const HorizontalBar = ({ label, value, percentage }: { label: string; value: string; percentage: number }) => {
  return (
    <div className="flex items-center">
      <span className="text-sm font-medium w-20">{label}</span>
      <div className="flex-1 h-4 bg-gray-100 rounded-full">
        <div
          className="bg-primary h-4 rounded-full transition-all duration-300"
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
      <span className="text-sm font-medium ml-3 w-12">{value}</span>
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
      ['Average Session Length', `${data.avgSessionLength.toFixed(1)}h`],
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
    value: day.percentage
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
              <span className="text-2xl font-bold text-gray-800">{data.avgSessionLength.toFixed(1)}h</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Booking Distribution Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Booking Distribution by Day</CardTitle>
        </CardHeader>
        <CardContent>
          <BarChart data={bookingByDayData} />
        </CardContent>
      </Card>

      {/* Popular Time Slots */}
      <Card>
        <CardHeader>
          <CardTitle>Popular Time Slots</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.popularTimeSlots.map((slot, index) => (
            <HorizontalBar
              key={index}
              label={slot.time}
              value={`${slot.percentage.toFixed(0)}%`}
              percentage={slot.percentage}
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminStatistics;
