'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface AnalyticsSummary {
  totalAppointments: number;
  pending: number;
  approved: number;
  rejected: number;
}

interface MonthlyTrend {
  month: string;
  total: number;
  approved: number;
  pending: number;
  rejected: number;
}

interface TopUser {
  email: string;
  totalRequests: number;
  approvedRequests: number;
}

interface PeakHour {
  hour: number;
  count: number;
}

interface PeakDay {
  dayName: string;
  dayOfWeek: number;
  count: number;
}

export default function AdminAnalytics() {
  const [data, setData] = useState<{
    summary: AnalyticsSummary;
    monthlyTrends: MonthlyTrend[];
    topUsers: TopUser[];
    peakHours: PeakHour[];
    peakDays: PeakDay[];
    estimatedRevenue: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/analytics')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch analytics');
        return res.json();
      })
      .then((json) => {
        setData(json.data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const COLORS = ['#0088FE', '#00C49F', '#FF8042', '#FF4B4B'];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-gray-200 rounded animate-pulse" />
          ))}
        </div>
        <div className="h-96 bg-gray-200 rounded animate-pulse" />
        <div className="h-64 bg-gray-200 rounded animate-pulse" />
      </div>
    );
  }

  if (error) {
    return <div className="text-red-500">Error: {error}</div>;
  }

  if (!data) return null;

  const statusData = [
    { name: 'Pending', value: data.summary.pending },
    { name: 'Approved', value: data.summary.approved },
    { name: 'Rejected', value: data.summary.rejected },
  ];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Appointments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{data.summary.totalAppointments}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-500">{data.summary.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Approved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-500">{data.summary.approved}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Rejected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-500">{data.summary.rejected}</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Trends */}
        <Card>
          <CardHeader>
            <CardTitle>Monthly Trends (Last 6 Months)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.monthlyTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="total" name="Total" stroke="#8884d8" />
                <Line type="monotone" dataKey="approved" name="Approved" stroke="#82ca9d" />
                <Line type="monotone" dataKey="pending" name="Pending" stroke="#ffc658" />
                <Line type="monotone" dataKey="rejected" name="Rejected" stroke="#ff8042" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry: { name?: string; percent?: number }) =>
                    `${entry.name ?? ''}: ${((entry.percent ?? 0) * 100).toFixed(0)}%`
                  }
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                  nameKey="name"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Peak Hours */}
      <Card>
        <CardHeader>
          <CardTitle>Peak Hours (Last 7 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.peakHours}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hour" label={{ value: 'Hour (WIB)', position: 'insideBottom', offset: -10 }} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#8884d8" name="Appointment Count" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Top Users */}
      <Card>
        <CardHeader>
          <CardTitle>Top Users (Last 30 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Email</th>
                  <th className="text-right p-2">Total Requests</th>
                  <th className="text-right p-2">Approved</th>
                </tr>
              </thead>
              <tbody>
                {data.topUsers.map((user, idx) => (
                  <tr key={idx} className="border-b">
                    <td className="p-2">{user.email}</td>
                    <td className="text-right p-2">{user.totalRequests}</td>
                    <td className="text-right p-2 text-green-500">{user.approvedRequests}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
