import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';

const API_BASE = 'http://localhost:8000/api/v1/dashboard';
const COLORS = ['#005493', '#009973', '#E67E22', '#8E44AD', '#C0392B'];

function AnalyticsDashboard({ userId = 'test123' }) {
  const [summary, setSummary] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [spending, setSpending] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [summaryRes, chartRes, productsRes, spendingRes] = await Promise.all([
        axios.get(`${API_BASE}/summary?user_id=${userId}`),
        axios.get(`${API_BASE}/revenue-cost-profit?user_id=${userId}`),
        axios.get(`${API_BASE}/top-products?user_id=${userId}`),
        axios.get(`${API_BASE}/spending-patterns?user_id=${userId}`)
      ]);

      setSummary(summaryRes.data);
      setChartData(chartRes.data.labels.map((label, i) => ({
        day: label,
        revenue: chartRes.data.revenue[i],
        cost: chartRes.data.cost[i],
        profit: chartRes.data.profit[i]
      })));
      setTopProducts(productsRes.data.products);
      setSpending(spendingRes.data.categories);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <h2>Inapakia data yako...</h2>
        <p>Tafadhali subiri dakika chache</p>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', padding: '20px', maxWidth: '1200px', margin: '0 auto', background: '#f5f5f5', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ background: '#005493', color: 'white', padding: '20px', borderRadius: '10px', marginBottom: '20px' }}>
        <h1 style={{ margin: 0 }}>📊 Dashibodi ya Biashara</h1>
        <p style={{ margin: '10px 0 0' }}>Teknolojia kwa Lugha Yetu • Mafanikio kwa Biashara Zetu</p>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '30px' }}>
        <div style={{ background: 'white', padding: '15px', borderRadius: '10px', borderLeft: '4px solid #009973', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <h3 style={{ margin: 0, color: '#666' }}>💰 Mapato</h3>
          <p style={{ fontSize: '24px', fontWeight: 'bold', margin: '10px 0', color: '#009973' }}>TZS {summary?.total_revenue?.toLocaleString()}</p>
        </div>
        <div style={{ background: 'white', padding: '15px', borderRadius: '10px', borderLeft: '4px solid #E67E22', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <h3 style={{ margin: 0, color: '#666' }}>💸 Gharama</h3>
          <p style={{ fontSize: '24px', fontWeight: 'bold', margin: '10px 0', color: '#E67E22' }}>TZS {summary?.total_cost?.toLocaleString()}</p>
        </div>
        <div style={{ background: 'white', padding: '15px', borderRadius: '10px', borderLeft: '4px solid #005493', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <h3 style={{ margin: 0, color: '#666' }}>📈 Faida</h3>
          <p style={{ fontSize: '24px', fontWeight: 'bold', margin: '10px 0', color: '#005493' }}>TZS {summary?.net_profit?.toLocaleString()}</p>
        </div>
        <div style={{ background: 'white', padding: '15px', borderRadius: '10px', borderLeft: '4px solid #C0392B', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <h3 style={{ margin: 0, color: '#666' }}>📊 Miamala</h3>
          <p style={{ fontSize: '24px', fontWeight: 'bold', margin: '10px 0', color: '#C0392B' }}>{summary?.transactions_count}</p>
        </div>
      </div>

      {/* Chart 1.6.1 - Revenue/Cost/Profit */}
      <div style={{ background: 'white', padding: '20px', borderRadius: '10px', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <h2 style={{ color: '#005493' }}>📉 1.6.1 Mwelekeo wa Mapato, Gharama & Faida</h2>
        <ResponsiveContainer width="100%" height={350}>
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="day" />
            <YAxis tickFormatter={(value) => `TZS ${(value/1000).toFixed(0)}K`} />
            <Tooltip formatter={(value) => `TZS ${value.toLocaleString()}`} />
            <Legend />
            <Area type="monotone" dataKey="revenue" name="Mapato" stroke="#009973" fill="#009973" fillOpacity={0.3} />
            <Area type="monotone" dataKey="cost" name="Gharama" stroke="#E67E22" fill="#E67E22" fillOpacity={0.3} />
            <Area type="monotone" dataKey="profit" name="Faida" stroke="#005493" fill="#005493" fillOpacity={0.3} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 1.6.2 - Top Products */}
      <div style={{ background: 'white', padding: '20px', borderRadius: '10px', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <h2 style={{ color: '#005493' }}>🏆 1.6.2 Bidhaa Bora</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={topProducts} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" tickFormatter={(value) => `TZS ${(value/1000).toFixed(0)}K`} />
            <YAxis type="category" dataKey="name" width={150} />
            <Tooltip formatter={(value) => `TZS ${value.toLocaleString()}`} />
            <Bar dataKey="revenue" name="Mapato" fill="#005493">
              {topProducts.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <table style={{ width: '100%', marginTop: '20px', borderCollapse: 'collapse' }}>
          <thead style={{ background: '#f5f5f5' }}>
            <tr>
              <th style={{ padding: '10px', textAlign: 'left' }}>Bidhaa</th>
              <th style={{ padding: '10px', textAlign: 'left' }}>Vitengo</th>
              <th style={{ padding: '10px', textAlign: 'left' }}>Mapato</th>
            </tr>
          </thead>
          <tbody>
            {topProducts.map((p, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #ddd' }}>
                <td style={{ padding: '10px' }}>{p.name}</td>
                <td style={{ padding: '10px' }}>{p.units}</td>
                <td style={{ padding: '10px', fontWeight: 'bold', color: '#009973' }}>TZS {p.revenue.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Chart 1.6.3 - Spending Patterns */}
      <div style={{ background: 'white', padding: '20px', borderRadius: '10px', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <h2 style={{ color: '#005493' }}>🥧 1.6.3 Mchanganuo wa Matumizi</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
          <div style={{ flex: 1, minWidth: '300px' }}>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={spending}
                  dataKey="amount"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                >
                  {spending.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `TZS ${value.toLocaleString()}`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{ flex: 1 }}>
            {spending.map((item, i) => (
              <div key={i} style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <span style={{ fontWeight: 'bold' }}>{item.category}</span>
                  <span><strong style={{ color: '#005493' }}>TZS {item.amount.toLocaleString()}</strong> ({item.percent}%)</span>
                </div>
                <div style={{ background: '#e0e0e0', height: '10px', borderRadius: '5px' }}>
                  <div style={{ width: `${item.percent}%`, height: '100%', background: COLORS[i % COLORS.length], borderRadius: '5px' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ textAlign: 'center', padding: '20px', color: '#666', marginTop: '20px' }}>
        <p>SwahiliSME Platform • DASUC 2026 • "Teknolojia kwa Lugha Yetu"</p>
      </div>
    </div>
  );
}

export default AnalyticsDashboard;