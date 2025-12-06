import KPIBox from '../KPIBox';
import { Briefcase, DollarSign, FileText, Clock } from 'lucide-react';

export default function KPIBoxExample() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4">
      <KPIBox 
        title="Jobs Today" 
        value={8} 
        icon={Briefcase}
        trend={{ value: 2, label: "from yesterday" }}
        onClick={() => console.log('Jobs Today clicked')}
      />
      <KPIBox 
        title="Unpaid Invoices" 
        value="$3,200" 
        icon={DollarSign}
        trend={{ value: -1, label: "from last week" }}
        onClick={() => console.log('Unpaid Invoices clicked')}
      />
      <KPIBox 
        title="Quotes Awaiting" 
        value={5} 
        icon={FileText}
        onClick={() => console.log('Quotes Awaiting clicked')}
      />
      <KPIBox 
        title="Month Earnings" 
        value="$18,500" 
        icon={Clock}
        trend={{ value: 12, label: "% vs last month" }}
      />
    </div>
  );
}