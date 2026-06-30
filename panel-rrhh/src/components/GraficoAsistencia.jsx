import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

function GraficoAsistencia({ datos, titulo }) {
  if (!datos || datos.length === 0) {
    return (
      <div className="card">
        <h3>{titulo}</h3>
        <p className="ayuda">No hay datos suficientes para graficar en este período.</p>
      </div>
    );
  }

  const chartData = datos.map(d => {
    let name = d.nombre;
    if (d.apellido) {
      name = `${d.nombre} ${d.apellido}`;
    }
    return {
      name,
      'A Tiempo': Number(d.a_tiempo) || 0,
      'Atrasos': Number(d.atrasos) || 0
    };
  });

  return (
    <div className="card">
      <h3>{titulo}</h3>
      <div className="grafico-chart-wrapper">
        <ResponsiveContainer>
          <BarChart
            data={chartData}
            margin={{ top: 10, right: 30, left: 0, bottom: 80 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
            <XAxis 
              dataKey="name" 
              tick={{ fontSize: 11, fill: '#6b7280' }} 
              axisLine={false} 
              tickLine={false}
              interval={0}
              angle={-45}
              textAnchor="end"
            />
            <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
            <Tooltip 
              cursor={{ fill: '#f3f4f6' }}
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            />
            <Legend iconType="circle" wrapperStyle={{ fontSize: '13px', paddingTop: '16px' }} />
            <Bar dataKey="A Tiempo" stackId="a" fill="#10b981" radius={[0, 0, 4, 4]} />
            <Bar dataKey="Atrasos" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default GraficoAsistencia;
