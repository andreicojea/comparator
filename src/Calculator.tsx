import { pmt, ppmt } from "financial";
import { useState } from "react";
import sum from "lodash/sum";
import sumBy from "lodash/sumBy";
import mapValues from "lodash/mapValues";

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

const DEFAULT_CONFIG: RawConfig = {
  loanTotal: "322830.96",
  loanInterest: "8.81",
  loanDuration: "284",
  investInterest: "8.81",
  preferLoanDuration: "0",
  measureDuration: "360",
  monthlyAvailable: "10000",
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

type RawConfig = { [key in keyof Config]: string };

interface ConfigInputParams {
  label: string;
  config: RawConfig;
  param: keyof RawConfig;
  setConfig: (params: RawConfig) => void;
}

interface ConfigFormParams {
  config: RawConfig;
  setConfig: (params: RawConfig) => unknown;
  data: Data;
}

interface MonthlyData {
  month: number;
  loanPrincipal: number;
  loanInterest: number;
  loanAdditional: number;
  loanNewTotal: number;
  loanNewDuration: number;
  additionalFromPrevious: number;
}

interface Data {
  payments: MonthlyData[];
  totalExpected: number;
  totalPaid: number;
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

function getPrincipalsWithAvailable(
  available: number,
  loanInterest: number,
  loanDuration: number,
  loanTotal: number
) {
  if (loanTotal <= 0) {
    return [];
  }

  let principals: number[] = [];
  let done = false;
  while (sum(principals) < available && !done) {
    const newPrincipal = getPrincipal(
      principals.length + 1,
      loanInterest,
      loanDuration,
      loanTotal
    );
    if (newPrincipal > 0) {
      principals.push(newPrincipal);
    } else {
      done = true;
    }
  }
  if (sum(principals) > available) {
    principals.pop();
  }

  return principals;
}

function getData(config: Config): Data {
  const loanMonthly = getMonthlyLoan(
    config.loanInterest,
    config.loanDuration,
    config.loanTotal
  );
  const payments: MonthlyData[] = [];

  for (let month = 1; month <= config.measureDuration; month++) {
    const loanTotalBeforePayment =
      payments.length === 0
        ? config.loanTotal
        : payments[payments.length - 1].loanNewTotal;

    const loanDurationBeforePayment =
      payments.length === 0
        ? config.loanDuration
        : payments[payments.length - 1].loanNewDuration;

    const additionalFromPrevious =
      payments.length === 0
        ? 0
        : payments[payments.length - 1].additionalFromPrevious;

    const loanPrincipal =
      loanTotalBeforePayment > 0
        ? getPrincipal(
            1,
            config.loanInterest,
            loanDurationBeforePayment,
            loanTotalBeforePayment
          )
        : 0;

    const loanInterest =
      loanTotalBeforePayment > 0 ? loanMonthly - loanPrincipal : 0;

    const loanAdditional =
      month <= config.preferLoanDuration && loanTotalBeforePayment > 0
        ? config.monthlyAvailable - loanMonthly + additionalFromPrevious
        : 0;

    const principals = getPrincipalsWithAvailable(
      loanAdditional,
      config.loanInterest,
      loanDurationBeforePayment - 1,
      loanTotalBeforePayment - loanPrincipal
    );

    const loanNewTotal =
      loanTotalBeforePayment - loanPrincipal - sum(principals);

    const loanNewDuration = Math.max(
      loanDurationBeforePayment - 1 - principals.length,
      0
    );

    payments.push({
      month,
      loanPrincipal,
      loanInterest,
      loanAdditional,
      loanNewTotal: loanNewTotal > 0 ? loanNewTotal : 0,
      loanNewDuration,
      additionalFromPrevious: loanAdditional - sum(principals),
    });
  }

  return {
    payments,
    totalExpected: loanMonthly * config.loanDuration,
    totalPaid: sumBy(
      payments,
      (p) => p.loanPrincipal + p.loanInterest + p.loanAdditional
    ),
    monthly: loanMonthly,
  };
}

function parseConfig(rawConfig: RawConfig): Config {
  return mapValues(rawConfig, (val) => (val ? Number(val) : 0));
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
            [param]: e.target.value,
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
        <ConfigInput
          label="Suma disponibila lunar"
          param="monthlyAvailable"
          config={config}
          setConfig={setConfig}
        ></ConfigInput>
        <ConfigInput
          label="Numar plati anticipate"
          param="preferLoanDuration"
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
          <label>Total fara plati anticipate</label>
          <input type="number" value={data.totalExpected.toFixed(2)} readOnly />
        </div>
        <div className="input-row">
          <label>Total cu plati anticipate</label>
          <input type="number" value={data.totalPaid.toFixed(2)} readOnly />
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
            <th colSpan={6} className="border">
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
            <th className="num">Rest credit</th>
            <th className="num border">Luni ramase</th>
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
              loanPrincipal,
              loanInterest,
              loanNewTotal,
              loanAdditional,
              loanNewDuration,
            }) => {
              return (
                <tr key={month}>
                  <td>{month}</td>
                  <td className="num">{loanPrincipal.toFixed(2)}</td>
                  <td className="num">{loanInterest.toFixed(2)}</td>
                  <td className="num">{loanAdditional.toFixed(2)}</td>
                  <td className="num">{loanNewTotal.toFixed(2)}</td>
                  <td className="num border">{loanNewDuration}</td>
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
  const [config, setConfig] = useState<RawConfig>(DEFAULT_CONFIG);

  const parsedConfig = parseConfig(config);
  const data = getData(parsedConfig);

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
