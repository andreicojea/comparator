import { fv, pmt, ppmt } from "financial";
import { useMemo, useState } from "react";
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
  ChartData,
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
  // measureDuration: "360",
  measureDuration: "",
  monthlyAvailable: "10000",
  // monthlyAvailable: `3051.36`,
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
  placeholder?: string;
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
  availableTotal: number;
  loanPrincipal: number;
  loanInterest: number;
  loanAdditional: number;
  loanNewTotal: number;
  loanNewDuration: number;
  additionalUnused: number;
  loanSaved: number;
  investAdd: number;
  investInterest: number;
  investNewTotal: number;
}

interface Data {
  monthlyData: MonthlyData[];
  totalLoanExpected: number;
  totalLoanPaid: number;
  loanMonthly: number;
  investResult: number;
  investMax: number;
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

function getInvestMax(config: Config) {
  let val = 0;
  const interest = config.investInterest / 100 / 12;
  const monthlyLoan = getMonthlyLoan(
    config.loanInterest,
    config.loanDuration,
    config.loanTotal
  );
  for (let month = 1; month <= config.measureDuration; month++) {
    val = val + interest * val + config.monthlyAvailable - monthlyLoan;
  }
  return val;
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

    const investBeforePayment =
      payments.length === 0 ? 0 : payments[payments.length - 1].investNewTotal;

    const additionalFromPrevious =
      payments.length === 0
        ? 0
        : payments[payments.length - 1].additionalUnused;

    const availableTotal = config.monthlyAvailable + additionalFromPrevious;

    const current: MonthlyData = {
      month,
      availableTotal,
      loanPrincipal: 0,
      loanInterest: 0,
      loanAdditional: 0,
      loanNewTotal: 0,
      loanNewDuration: 0,
      additionalUnused: availableTotal,
      loanSaved: 0,
      investAdd: 0,
      investInterest: 0,
      investNewTotal: 0,
    };

    if (loanTotalBeforePayment > 0) {
      current.loanPrincipal = getPrincipal(
        1,
        config.loanInterest,
        loanDurationBeforePayment,
        loanTotalBeforePayment
      );

      current.loanInterest = loanMonthly - current.loanPrincipal;

      const principals =
        month <= config.preferLoanDuration
          ? getPrincipalsWithAvailable(
              availableTotal - loanMonthly,
              config.loanInterest,
              loanDurationBeforePayment - 1,
              loanTotalBeforePayment - current.loanPrincipal
            )
          : [];

      current.loanAdditional = sum(principals);
      current.additionalUnused =
        availableTotal - loanMonthly - current.loanAdditional;
      current.loanSaved = sum(principals.map((p) => loanMonthly - p));

      current.loanNewTotal = Math.max(
        loanTotalBeforePayment - current.loanPrincipal - current.loanAdditional,
        0
      );

      current.loanNewDuration = Math.max(
        loanDurationBeforePayment - 1 - principals.length,
        0
      );
    }

    if (current.loanNewDuration === 0 || month > config.preferLoanDuration) {
      current.investAdd = current.additionalUnused;
      current.additionalUnused = 0;
    }
    current.investInterest =
      (config.investInterest / 100 / 12) * investBeforePayment;
    current.investNewTotal =
      investBeforePayment + current.investAdd + current.investInterest;

    payments.push(current);
  }

  return {
    monthlyData: payments,
    totalLoanExpected: loanMonthly * config.loanDuration,
    totalLoanPaid: sumBy(
      payments,
      (p) => p.loanPrincipal + p.loanInterest + p.loanAdditional
    ),
    loanMonthly,
    investResult: payments[payments.length - 1].investNewTotal,
    investMax: getInvestMax(config),
  };
}

function parseConfig(rawConfig: RawConfig): Config {
  const config = mapValues(rawConfig, (val) => (val ? Number(val) : 0));
  config.measureDuration = Math.max(
    config.loanDuration,
    config.measureDuration
  );
  return config;
}

const ConfigInput = ({
  label,
  placeholder,
  param,
  config,
  setConfig,
}: ConfigInputParams) => {
  return (
    <div className="input-row">
      <label>{label}</label>
      <input
        type="number"
        placeholder={placeholder}
        value={config[param]}
        min={0}
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
  const loanSavedPercent =
    -(1 - data.totalLoanPaid / data.totalLoanExpected) * 100;

  const investmentPercent = -(1 - data.investResult / data.investMax) * 100;
  const investmentPercentSign = investmentPercent > 0 ? "+" : "";

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
          label="Dobanda anuala credit (%)"
          param="loanInterest"
          config={config}
          setConfig={setConfig}
        ></ConfigInput>
        <ConfigInput
          label="Dobanda anuala investitie (%)"
          param="investInterest"
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
          label="Durata totala"
          placeholder={config.loanDuration}
          param="measureDuration"
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
          <label>Rata lunara credit</label>
          <input type="number" value={data.loanMonthly.toFixed(2)} readOnly />
        </div>
        <div className="input-row">
          <label>Total fara plati anticipate</label>
          <input
            type="number"
            value={data.totalLoanExpected.toFixed(2)}
            readOnly
          />
        </div>
        <div className="input-row">
          <label>
            Total cu plati anticipate
            {loanSavedPercent < 0 && (
              <span> ({loanSavedPercent.toFixed(2)}%)</span>
            )}
          </label>
          <input type="number" value={data.totalLoanPaid.toFixed(2)} readOnly />
        </div>
        <div className="input-row max">
          <label>Rezultat fara plati anticipate</label>
          <input type="number" value={data.investMax.toFixed(2)} readOnly />
        </div>
        <div className="input-row result">
          <label>
            Rezultat cu plati anticipate
            {(investmentPercent > 0.01 || investmentPercent < -0.01) && (
              <span>
                {" "}
                ({investmentPercentSign}
                {investmentPercent.toFixed(2)}%)
              </span>
            )}
          </label>
          <input type="number" value={data.investResult.toFixed(2)} readOnly />
        </div>
      </div>
    </>
  );
};

const InvestChart = ({ data, config }: { data: Data; config: Config }) => {
  const chartOptions = useMemo<ChartOptions<"bar">>(() => {
    return {
      responsive: true,
      scales: {
        x: {
          stacked: true,
          max: config.loanDuration,
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
  }, [config.loanDuration]);

  const chartData: ChartData<"bar", number[], number> = {
    labels: data.monthlyData.map((p) => p.month),
    datasets: [
      {
        label: "Investitie",
        data: data.monthlyData.map((p) => p.investNewTotal),
        backgroundColor: (context) => {
          return data.monthlyData[context.dataIndex].loanInterest == 0
            ? "rgba(255,158,64, 0.5)"
            : "rgba(76, 192, 192, 0.5)";
        },
      },
    ],
  };

  return (
    <div className="chart-container">
      <Bar options={chartOptions} data={chartData} />
    </div>
  );
};

const LoanChart = ({ data, config }: { data: Data; config: Config }) => {
  const chartOptions = useMemo<ChartOptions<"bar">>(() => {
    return {
      responsive: true,
      scales: {
        x: {
          stacked: true,
          max: config.loanDuration,
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
  }, [config.loanDuration]);

  const chartData = {
    labels: data.monthlyData.map((p) => p.month),
    datasets: [
      {
        label: "Dobanda",
        data: data.monthlyData.map((p) => p.loanInterest),
        backgroundColor: "rgba(255, 99, 132, 0.5)",
      },
      {
        label: "Principal",
        data: data.monthlyData.map((p) => p.loanPrincipal),
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
  return (
    <>
      <label>Credit vs Fond de investitii</label>
      <table>
        <thead>
          <tr>
            <th colSpan={2} className="border"></th>
            <th colSpan={6} className="border">
              Credit
            </th>
            <th colSpan={3}>Fond de investitii</th>
          </tr>
          <tr>
            <th>Luna</th>
            <th className="border">Suma</th>
            <th className="num">Principal</th>
            <th className="num">Dobanda</th>
            <th className="num">Anticipat</th>
            <th className="num">Rest credit</th>
            <th className="num">Luni ramase</th>
            <th className="num border">Dobanda scutita</th>
            <th className="num">Investitie</th>
            <th className="num">Dobanda</th>
            <th className="num">Valoare curenta</th>
          </tr>
        </thead>
        <tbody>
          {data.monthlyData.map((current) => {
            return (
              <tr key={current.month}>
                <td>{current.month}</td>
                <td className="border">{current.availableTotal.toFixed(2)}</td>
                <td className="num">{current.loanPrincipal.toFixed(2)}</td>
                <td className="num">{current.loanInterest.toFixed(2)}</td>
                <td className="num">{current.loanAdditional.toFixed(2)}</td>
                <td className="num">{current.loanNewTotal.toFixed(2)}</td>
                <td className="num">{current.loanNewDuration}</td>
                <td className="num border">{current.loanSaved.toFixed(2)}</td>
                <td className="num">{current.investAdd.toFixed(2)}</td>
                <td className="num">{current.investInterest.toFixed(2)}</td>
                <td className="num">{current.investNewTotal.toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
};

export const Calculator = () => {
  const [rawConfig, setRawConfig] = useState<RawConfig>(DEFAULT_CONFIG);

  const config = parseConfig(rawConfig);
  const data = getData(config);

  return (
    <>
      <ConfigForm
        config={rawConfig}
        setConfig={setRawConfig}
        data={data}
      ></ConfigForm>
      <div className="charts-row">
        <LoanChart config={config} data={data}></LoanChart>
        <InvestChart config={config} data={data}></InvestChart>
      </div>
      <Table data={data}></Table>
    </>
  );
};
