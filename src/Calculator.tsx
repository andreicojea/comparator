import { pmt, ppmt } from "financial";
import { useState, useMemo } from "react";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const DEFAULT_CONFIG: Config = {
  loanTotal: 322830.96,
  loanInterest: 8.81,
  loanDuration: 284,
  investInterest: 8.81,
  preferLoanDuration: 0,
  measureDuration: 360,
  monthlyAvailable: 10000,
};

interface Config {
  loanTotal: number;
  loanDuration: number;
  loanInterest: number;
  investInterest: number;
  preferLoanDuration: number;
  measureDuration: number;
  monthlyAvailable: number;
}

interface ConfigInputParams {
  label: string;
  config: Config;
  param: keyof Config;
  setConfig: (params: Config) => void;
}

interface ConfigFormParams {
  config: Config;
  setConfig: (params: Config) => unknown;
  data: Data;
}

interface TableParams {
  loanData: Data;
}

interface MonthlyData {
  month: number;
  loanPrincipal: number;
  loanInterest: number;
  loanNewTotal: number;
}

interface Data {
  payments: MonthlyData[];
  total: number;
  monthly: number;
}

function getMonthlyLoan(
  loanInterest: number,
  loanDuration: number,
  loanTotal: number
) {
  return -pmt(loanInterest / 100 / 12, loanDuration, loanTotal);
}

function getPrincipal(
  month: number,
  loanInterest: number,
  loanDuration: number,
  loanTotal: number
) {
  return -ppmt(loanInterest / 100 / 12, month, loanDuration, loanTotal);
}

function getData(config: Config): Data {
  const loanMonthly = getMonthlyLoan(
    config.loanInterest,
    config.loanDuration,
    config.loanTotal
  );
  const payments: MonthlyData[] = [];

  for (let month = 1; month <= config.loanDuration; month++) {
    const totalBeforePayment =
      payments.length === 0
        ? config.loanTotal
        : payments[payments.length - 1].loanNewTotal;

    const principal = getPrincipal(
      1,
      config.loanInterest,
      config.loanDuration - month + 1,
      totalBeforePayment
    );

    payments.push({
      month,
      loanPrincipal: principal,
      loanInterest: loanMonthly - principal,
      loanNewTotal: totalBeforePayment - principal,
    });
  }

  return {
    payments,
    total: loanMonthly * config.loanDuration,
    monthly: loanMonthly,
  };
}

const ConfigInput = ({
  label,
  param,
  config,
  setConfig,
}: ConfigInputParams) => {
  return (
    <div className="input-row">
      <label>{label}</label>
      <input
        type="number"
        value={config[param]}
        onChange={(e) =>
          setConfig({
            ...config,
            [param]: Number(e.target.value),
          })
        }
      />
    </div>
  );
};

const ConfigForm = ({ config, setConfig, data }: ConfigFormParams) => {
  return (
    <>
      <div className="inline-inputs">
        <ConfigInput
          label="Valoare credit"
          param="loanTotal"
          config={config}
          setConfig={setConfig}
        ></ConfigInput>
        <ConfigInput
          label="Durata credit (luni)"
          param="loanDuration"
          config={config}
          setConfig={setConfig}
        ></ConfigInput>
        <ConfigInput
          label="Dobanda anuala (%)"
          param="loanInterest"
          config={config}
          setConfig={setConfig}
        ></ConfigInput>
      </div>
      <div className="inline-inputs">
        <div className="input-row">
          <label>Rata lunara</label>
          <input type="number" value={data.monthly.toFixed(2)} readOnly />
        </div>
        <div className="input-row">
          <label>Total rambursat</label>
          <input type="number" value={data.total.toFixed(2)} readOnly />
        </div>
      </div>
    </>
  );
};

const chartOptions: ChartOptions<"bar"> = {
  responsive: true,
  scales: {
    x: {
      stacked: true,
    },
    y: {
      stacked: true,
    },
  },
  datasets: {
    bar: {
      barPercentage: 1,
      categoryPercentage: 1,
    },
  },
  aspectRatio: 9 / 6,
  animation: false,
};

const LoanChart = ({ data }: { data: Data }) => {
  const chartData = {
    labels: data.payments.map((p) => p.month),
    datasets: [
      {
        label: "Dobanda",
        data: data.payments.map((p) => p.loanInterest),
        backgroundColor: "rgba(255, 99, 132, 0.5)",
      },
      {
        label: "Principal",
        data: data.payments.map((p) => p.loanPrincipal),
        backgroundColor: "rgba(53, 162, 235, 0.5)",
      },
    ],
  };

  return (
    <div className="chart-container">
      <Bar options={chartOptions} data={chartData} />
    </div>
  );
};

const Table = ({ data }: { data: Data }) => {
  // console.log(-pmt(LOAN_INTEREST, LOAN_MONTHS, LOAN_TOTAL));
  // console.log(-ppmt(LOAN_INTEREST, 1, LOAN_MONTHS, LOAN_TOTAL));

  return (
    <>
      <label>Credit vs Fond de investitii</label>
      <table>
        <thead>
          <tr>
            <th colSpan={5} className="border">
              Credit
            </th>
            <th colSpan={3} className="border">
              Fond de investitii
            </th>
            <th>Averea Fam. Viking</th>
          </tr>
          <tr>
            <th>Luna</th>
            <th className="num">Principal</th>
            <th className="num">Dobanda</th>
            <th className="num">Anticipat</th>
            <th className="num border">Rest credit</th>
            <th className="num">Investitie</th>
            <th className="num">Dobanda</th>
            <th className="num border">Valoare curenta</th>
            <th className="num">Total</th>
          </tr>
        </thead>
        <tbody>
          {data.payments.map(
            ({
              month,
              loanPrincipal: principal,
              loanInterest: interest,
              loanNewTotal: rest,
            }) => {
              return (
                <tr key={month}>
                  <td>{month}</td>
                  <td className="num">{principal.toFixed(2)}</td>
                  <td className="num">{interest.toFixed(2)}</td>
                  <td className="num">0</td>
                  <td className="num border">{rest.toFixed(2)}</td>
                  <td className="num">0</td>
                  <td className="num">0</td>
                  <td className="num border">123456</td>
                  <td className="num">0</td>
                </tr>
              );
            }
          )}
        </tbody>
      </table>
    </>
  );
};

export const Calculator = () => {
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);

  const data = getData(config);

  return (
    <>
      <ConfigForm
        config={config}
        setConfig={setConfig}
        data={data}
      ></ConfigForm>
      <LoanChart data={data}></LoanChart>
      <Table data={data}></Table>
    </>
  );
};
