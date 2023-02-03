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

// const LOAN_TOTAL = 322830.96;
// // const LOAN_INTEREST = 0.00734169686;
// const LOAN_INTEREST = 8.81;
// const LOAN_MONTHS = 284;

const DEFAULT_CONFIG: Config = {
  loanTotal: 322830.96,
  loanInterest: 8.81,
  loanDuration: 284,
  investInterest: 8.81,
  preferLoanDuration: 0,
  measureDuration: 360,
  monthlyAvailable: 10000,
};

// const LOAN_TOTAL = 300000;
// const LOAN_INTEREST = 0.007883333; // DAE 9,92%
// const LOAN_MONTHS = 360;

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
  loanData: LoanData;
}

interface TableParams {
  loanData: LoanData;
}

interface LoanMonthlyData {
  month: number;
  principal: number;
  interest: number;
  rest: number;
}

interface LoanData {
  payments: LoanMonthlyData[];
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

function getLoanData(
  loanInterest: number,
  loanDuration: number,
  loanTotal: number
): LoanData {
  const loanMonthly = getMonthlyLoan(loanInterest, loanDuration, loanTotal);
  const payments: LoanMonthlyData[] = [];

  for (let month = 1; month <= loanDuration; month++) {
    const principal = getPrincipal(
      month,
      loanInterest,
      loanDuration,
      loanTotal
    );
    const total =
      payments.length === 0 ? loanTotal : payments[payments.length - 1].rest;

    payments.push({
      month,
      principal,
      interest: loanMonthly - principal,
      rest: total - principal,
    });
  }

  return { payments, total: loanMonthly * loanDuration, monthly: loanMonthly };
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

const ConfigForm = ({ config, setConfig, loanData }: ConfigFormParams) => {
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
          <input type="number" value={loanData.monthly.toFixed(2)} readOnly />
        </div>
        <div className="input-row">
          <label>Total rambursat</label>
          <input type="number" value={loanData.total.toFixed(2)} readOnly />
        </div>
      </div>
    </>
  );
};

const LoanChart = ({ loanData }: TableParams) => {
  const options = useMemo<ChartOptions<"bar">>(() => {
    return {
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
  }, []);

  const data = {
    labels: loanData.payments.map((p) => p.month),
    datasets: [
      {
        label: "Dobanda",
        data: loanData.payments.map((p) => p.interest),
        backgroundColor: "rgba(255, 99, 132, 0.5)",
      },
      {
        label: "Principal",
        data: loanData.payments.map((p) => p.principal),
        backgroundColor: "rgba(53, 162, 235, 0.5)",
      },
    ],
  };

  return (
    <div className="chart-container">
      <Bar options={options} data={data} />
    </div>
  );
};

const Table = ({ loanData }: TableParams) => {
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
          {loanData.payments.map(({ month, principal, interest, rest }) => {
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
          })}
        </tbody>
      </table>
    </>
  );
};

export const Calculator = () => {
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);

  const loanData = getLoanData(
    config.loanInterest,
    config.loanDuration,
    config.loanTotal
  );

  return (
    <>
      <ConfigForm
        config={config}
        setConfig={setConfig}
        loanData={loanData}
      ></ConfigForm>
      <LoanChart loanData={loanData}></LoanChart>
      <Table loanData={loanData}></Table>
    </>
  );
};
