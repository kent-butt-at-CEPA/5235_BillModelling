const svgNs = "http://www.w3.org/2000/svg";
const currency = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

const cepa = {
  blue: "#002776",
  red: "#F7403A",
  orange: "#FFA02F",
  yellow: "#F3CF45",
  lime: "#BED600",
  purple: "#7765A0",
  teal: "#009AA6",
  sky: "#65CFE9",
  grey: "#C9CAC8",
  indigo: "#5A85D7",
  black: "#000000",
};

const componentColors = {
  "Electricity unit charge": cepa.blue,
  "Gas unit charge": cepa.red,
  "Electricity standing charge": cepa.indigo,
  "Gas standing charge": cepa.orange,
  "Network and metering": cepa.teal,
  "Policy and system costs": cepa.grey,
};

const state = {
  data: null,
  archetypeId: null,
  regionId: null,
  year: null,
};

const els = {
  datasetNote: document.getElementById("datasetNote"),
  archetypeSelect: document.getElementById("archetypeSelect"),
  regionSelect: document.getElementById("regionSelect"),
  yearSlider: document.getElementById("yearSlider"),
  yearValue: document.getElementById("yearValue"),
  scenarioTitle: document.getElementById("scenarioTitle"),
  scenarioDescription: document.getElementById("scenarioDescription"),
  annualBillValue: document.getElementById("annualBillValue"),
  annualBillMeta: document.getElementById("annualBillMeta"),
  deltaValue: document.getElementById("deltaValue"),
  deltaMeta: document.getElementById("deltaMeta"),
  peakMonthValue: document.getElementById("peakMonthValue"),
  peakMonthMeta: document.getElementById("peakMonthMeta"),
  benchmarkValue: document.getElementById("benchmarkValue"),
  benchmarkMeta: document.getElementById("benchmarkMeta"),
  lineChart: document.getElementById("lineChart"),
  barChart: document.getElementById("barChart"),
  heatmapChart: document.getElementById("heatmapChart"),
  heatmapLegend: document.getElementById("heatmapLegend"),
};

document.addEventListener("DOMContentLoaded", () => {
  initialiseDashboard().catch((error) => {
    els.datasetNote.textContent = "Unable to load dashboard data.";
    console.error(error);
  });
});

async function initialiseDashboard() {
  const response = await fetch("./dashboard-data.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Unexpected response: ${response.status}`);
  }

  state.data = await response.json();
  state.archetypeId = state.data.archetypes[0].id;
  state.regionId = "scotland";
  state.year = 2028;

  els.datasetNote.textContent = state.data.note;
  populateSelect(els.archetypeSelect, state.data.archetypes, state.archetypeId);
  populateSelect(els.regionSelect, state.data.regions, state.regionId);
  els.yearSlider.min = state.data.years[0];
  els.yearSlider.max = state.data.years[state.data.years.length - 1];
  els.yearSlider.value = String(state.year);

  els.archetypeSelect.addEventListener("change", (event) => {
    state.archetypeId = event.target.value;
    render();
  });

  els.regionSelect.addEventListener("change", (event) => {
    state.regionId = event.target.value;
    render();
  });

  els.yearSlider.addEventListener("input", (event) => {
    state.year = Number(event.target.value);
    render();
  });

  window.addEventListener("resize", debounce(render, 120));
  render();
}

function populateSelect(selectElement, items, selectedId) {
  selectElement.innerHTML = "";
  items.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = item.name;
    option.selected = item.id === selectedId;
    selectElement.appendChild(option);
  });
}

function render() {
  if (!state.data) {
    return;
  }

  els.yearValue.textContent = String(state.year);

  const archetype = state.data.archetypes.find((item) => item.id === state.archetypeId);
  const region = state.data.regions.find((item) => item.id === state.regionId);
  const selectedAnnualBill = getAnnualBill(state.archetypeId, state.regionId, state.year);
  const baseAnnualBill = getAnnualBill(state.archetypeId, state.regionId, state.data.years[0]);
  const monthlyBills = getMonthlyBills(state.archetypeId, state.regionId, state.year);
  const peakMonth = getPeakMonth(monthlyBills);
  const regionalAverage = getRegionalAverage(state.archetypeId, state.year);
  const yearlyDelta = selectedAnnualBill - baseAnnualBill;

  els.scenarioTitle.textContent = `${archetype.name} in ${region.name}`;
  els.scenarioDescription.textContent = archetype.description;

  els.annualBillValue.textContent = formatCurrency(selectedAnnualBill);
  els.annualBillMeta.textContent = `Illustrative annual bill for ${state.year}.`;

  els.deltaValue.textContent = signedCurrency(yearlyDelta);
  els.deltaMeta.textContent = `Compared with the ${state.data.years[0]} baseline for this same region and archetype.`;

  els.peakMonthValue.textContent = `${peakMonth.month} ${formatCurrency(peakMonth.value)}`;
  els.peakMonthMeta.textContent = "Highest monthly bill in the selected forecast year.";

  els.benchmarkValue.textContent = signedCurrency(selectedAnnualBill - regionalAverage);
  els.benchmarkMeta.textContent = "Difference from the UK regional average for this archetype and year.";

  renderLineChart();
  renderBarChart();
  renderHeatmap();
}

function renderLineChart() {
  const selectedYears = state.data.years;
  const regionalSeries = selectedYears.map((year) => getAnnualBill(state.archetypeId, state.regionId, year));
  const averageSeries = selectedYears.map((year) => getRegionalAverage(state.archetypeId, year));

  const series = [
    { label: getRegionName(state.regionId), values: regionalSeries, color: cepa.blue },
    { label: "UK average", values: averageSeries, color: cepa.indigo, dashed: true },
  ];

  const bounds = series.flatMap((line) => line.values);
  const minValue = Math.min(...bounds) * 0.92;
  const maxValue = Math.max(...bounds) * 1.06;

  const width = 720;
  const height = 340;
  const margin = { top: 18, right: 28, bottom: 52, left: 78 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  els.lineChart.innerHTML = "";
  const svg = createSvg(width, height);

  addHorizontalGrid(svg, margin, plotWidth, plotHeight, minValue, maxValue, 5);

  selectedYears.forEach((year, index) => {
    const x = margin.left + (index / (selectedYears.length - 1)) * plotWidth;
    const tick = svgEl("text", {
      x,
      y: height - 20,
      class: "tick-label",
      "text-anchor": "middle",
    });
    tick.textContent = year;
    svg.appendChild(tick);
  });

  for (let i = 0; i <= 5; i += 1) {
    const value = minValue + ((maxValue - minValue) * i) / 5;
    const y = margin.top + plotHeight - (i / 5) * plotHeight;
    const label = svgEl("text", {
      x: margin.left - 12,
      y: y + 4,
      class: "tick-label",
      "text-anchor": "end",
    });
    label.textContent = formatCurrency(value);
    svg.appendChild(label);
  }

  const activeYearIndex = selectedYears.indexOf(state.year);
  const activeX = margin.left + (activeYearIndex / (selectedYears.length - 1)) * plotWidth;
  svg.appendChild(
    svgEl("line", {
      x1: activeX,
      x2: activeX,
      y1: margin.top,
      y2: margin.top + plotHeight,
      stroke: "rgba(0, 0, 0, 0.18)",
      "stroke-width": 1.5,
      "stroke-dasharray": "4 6",
    }),
  );

  series.forEach((line) => {
    const points = line.values.map((value, index) => {
      const x = margin.left + (index / (selectedYears.length - 1)) * plotWidth;
      const y = margin.top + plotHeight - ((value - minValue) / (maxValue - minValue)) * plotHeight;
      return { x, y, value };
    });

    const path = svgEl("path", {
      d: `M ${points.map((point) => `${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" L ")}`,
      fill: "none",
      stroke: line.color,
      "stroke-width": 3.2,
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      "stroke-dasharray": line.dashed ? "8 7" : "",
    });
    svg.appendChild(path);

    points.forEach((point, index) => {
      const isActiveYear = index === activeYearIndex;
      const marker = svgEl("circle", {
        cx: point.x,
        cy: point.y,
        r: isActiveYear ? 5 : 3.5,
        fill: line.color,
        opacity: isActiveYear ? 1 : 0.82,
      });
      const title = svgEl("title");
      title.textContent = `${line.label}, ${selectedYears[index]}: ${formatCurrency(point.value)}`;
      marker.appendChild(title);
      svg.appendChild(marker);
    });

    const last = points[points.length - 1];
    const legendText = svgEl("text", {
      x: last.x + 10,
      y: last.y + (line.dashed ? 16 : -10),
      class: "annotation",
      fill: line.color,
    });
    legendText.textContent = line.label;
    svg.appendChild(legendText);
  });

  svg.appendChild(
    svgEl("text", {
      x: width / 2,
      y: height - 4,
      class: "axis-label",
      "text-anchor": "middle",
    }, "Forecast year"),
  );
  svg.appendChild(
    svgEl("text", {
      x: 18,
      y: height / 2,
      class: "axis-label",
      transform: `rotate(-90 18 ${height / 2})`,
      "text-anchor": "middle",
    }, "Annual bill"),
  );

  els.lineChart.appendChild(svg);
}

function renderBarChart() {
  const regionBreakdown = getBreakdown(state.archetypeId, state.regionId, state.year);
  const averageBreakdown = getAverageBreakdown(state.archetypeId, state.year);
  const bars = [
    { label: getRegionName(state.regionId), values: regionBreakdown },
    { label: "UK average", values: averageBreakdown },
  ];

  const width = 720;
  const height = 340;
  const margin = { top: 18, right: 28, bottom: 78, left: 70 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const totals = bars.map((bar) => Object.values(bar.values).reduce((sum, value) => sum + value, 0));
  const maxValue = Math.max(...totals) * 1.12;

  els.barChart.innerHTML = "";
  const svg = createSvg(width, height);
  addHorizontalGrid(svg, margin, plotWidth, plotHeight, 0, maxValue, 5);

  for (let i = 0; i <= 5; i += 1) {
    const value = (maxValue * i) / 5;
    const y = margin.top + plotHeight - (i / 5) * plotHeight;
    const label = svgEl("text", {
      x: margin.left - 12,
      y: y + 4,
      class: "tick-label",
      "text-anchor": "end",
    });
    label.textContent = formatCurrency(value);
    svg.appendChild(label);
  }

  const barWidth = 150;
  const gap = (plotWidth - barWidth * bars.length) / (bars.length + 1);

  bars.forEach((bar, index) => {
    const barX = margin.left + gap + index * (barWidth + gap);
    let stackBase = margin.top + plotHeight;

    state.data.components.forEach((component) => {
      const value = bar.values[component];
      const barHeight = (value / maxValue) * plotHeight;
      stackBase -= barHeight;

      const rect = svgEl("rect", {
        x: barX,
        y: stackBase,
        width: barWidth,
        height: barHeight,
        rx: 8,
        fill: componentColors[component],
      });
      const title = svgEl("title");
      title.textContent = `${bar.label} | ${component}: ${formatCurrency(value)}`;
      rect.appendChild(title);
      svg.appendChild(rect);
    });

    const totalLabel = svgEl("text", {
      x: barX + barWidth / 2,
      y: stackBase - 10,
      class: "annotation",
      "text-anchor": "middle",
    });
    totalLabel.textContent = formatCurrency(totals[index]);
    svg.appendChild(totalLabel);

    const name = svgEl("text", {
      x: barX + barWidth / 2,
      y: height - 28,
      class: "axis-label",
      "text-anchor": "middle",
    });
    name.textContent = bar.label;
    svg.appendChild(name);
  });

  const legendGroup = svgEl("g", { transform: `translate(${margin.left}, ${height - 56})` });
  state.data.components.forEach((component, index) => {
    const x = index * 102;
    legendGroup.appendChild(
      svgEl("rect", {
        x,
        y: 0,
        width: 12,
        height: 12,
        rx: 3,
        fill: componentColors[component],
      }),
    );
    const label = svgEl("text", {
      x: x + 18,
      y: 10,
      class: "legend-text",
    });
    label.textContent = shortComponentLabel(component);
    legendGroup.appendChild(label);
  });
  svg.appendChild(legendGroup);

  svg.appendChild(
    svgEl("text", {
      x: 18,
      y: height / 2,
      class: "axis-label",
      transform: `rotate(-90 18 ${height / 2})`,
      "text-anchor": "middle",
    }, "Annual bill"),
  );

  els.barChart.appendChild(svg);
}

function renderHeatmap() {
  const rows = state.data.regions.map((region) => ({
    id: region.id,
    name: region.name,
    values: getMonthlyBills(state.archetypeId, region.id, state.year),
  }));

  const allValues = rows.flatMap((row) => row.values);
  const minValue = Math.min(...allValues);
  const maxValue = Math.max(...allValues);

  const width = 940;
  const height = 430;
  const margin = { top: 24, right: 24, bottom: 40, left: 150 };
  const cellWidth = (width - margin.left - margin.right) / state.data.months.length;
  const cellHeight = (height - margin.top - margin.bottom) / rows.length;

  els.heatmapChart.innerHTML = "";
  const svg = createSvg(width, height);

  state.data.months.forEach((month, colIndex) => {
    const label = svgEl("text", {
      x: margin.left + colIndex * cellWidth + cellWidth / 2,
      y: 16,
      class: "axis-label",
      "text-anchor": "middle",
    });
    label.textContent = month;
    svg.appendChild(label);
  });

  rows.forEach((row, rowIndex) => {
    const y = margin.top + rowIndex * cellHeight;
    const rowLabel = svgEl("text", {
      x: margin.left - 12,
      y: y + cellHeight / 2 + 4,
      class: "axis-label",
      "text-anchor": "end",
    });
    rowLabel.textContent = row.name;
    svg.appendChild(rowLabel);

    row.values.forEach((value, colIndex) => {
      const x = margin.left + colIndex * cellWidth;
      const rect = svgEl("rect", {
        x,
        y,
        width: cellWidth - 3,
        height: cellHeight - 3,
        rx: 8,
        fill: interpolateColor(value, minValue, maxValue),
      });
      const title = svgEl("title");
      title.textContent = `${row.name}, ${state.data.months[colIndex]} ${state.year}: ${formatCurrency(value)}`;
      rect.appendChild(title);
      svg.appendChild(rect);
    });

    if (row.id === state.regionId) {
      svg.appendChild(
        svgEl("rect", {
          x: margin.left - 4,
          y: y - 2,
          width: cellWidth * state.data.months.length + 5,
          height: cellHeight,
          rx: 12,
          fill: "none",
          stroke: cepa.red,
          "stroke-width": 2.5,
        }),
      );
    }
  });

  els.heatmapChart.appendChild(svg);
  renderHeatmapLegend(minValue, maxValue);
}

function renderHeatmapLegend(minValue, maxValue) {
  els.heatmapLegend.innerHTML = `
    <div class="legend-scale">
      <span>Lower bills</span>
      <div class="legend-gradient"></div>
      <span>Higher bills</span>
    </div>
    <div class="legend-labels">
      <span>${formatCurrency(minValue)}</span>
      <span>${formatCurrency(maxValue)}</span>
    </div>
  `;
}

function addHorizontalGrid(svg, margin, plotWidth, plotHeight, minValue, maxValue, steps) {
  for (let i = 0; i <= steps; i += 1) {
    const y = margin.top + plotHeight - (i / steps) * plotHeight;
    const line = svgEl("line", {
      x1: margin.left,
      x2: margin.left + plotWidth,
      y1: y,
      y2: y,
      stroke: "rgba(201, 202, 200, 1)",
      "stroke-width": 1,
    });
    const title = svgEl("title");
    title.textContent = `${formatCurrency(minValue + ((maxValue - minValue) * i) / steps)}`;
    line.appendChild(title);
    svg.appendChild(line);
  }
}

function getAnnualBill(archetypeId, regionId, year) {
  return state.data.annual_bills[archetypeId][regionId][String(year)];
}

function getMonthlyBills(archetypeId, regionId, year) {
  return state.data.monthly_bills[archetypeId][String(year)][regionId];
}

function getBreakdown(archetypeId, regionId, year) {
  return state.data.breakdowns[archetypeId][regionId][String(year)];
}

function getRegionalAverage(archetypeId, year) {
  const values = state.data.regions.map((region) => getAnnualBill(archetypeId, region.id, year));
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getAverageBreakdown(archetypeId, year) {
  const values = {};
  state.data.components.forEach((component) => {
    values[component] = 0;
  });

  state.data.regions.forEach((region) => {
    const breakdown = getBreakdown(archetypeId, region.id, year);
    state.data.components.forEach((component) => {
      values[component] += breakdown[component];
    });
  });

  const count = state.data.regions.length;
  state.data.components.forEach((component) => {
    values[component] /= count;
  });
  return values;
}

function getPeakMonth(values) {
  let bestIndex = 0;
  values.forEach((value, index) => {
    if (value > values[bestIndex]) {
      bestIndex = index;
    }
  });
  return {
    month: state.data.months[bestIndex],
    value: values[bestIndex],
  };
}

function getRegionName(regionId) {
  return state.data.regions.find((region) => region.id === regionId).name;
}

function shortComponentLabel(component) {
  const labels = {
    "Electricity unit charge": "Elec unit",
    "Gas unit charge": "Gas unit",
    "Electricity standing charge": "Elec standing",
    "Gas standing charge": "Gas standing",
    "Network and metering": "Network",
    "Policy and system costs": "Policy",
  };
  return labels[component] || component;
}

function createSvg(width, height) {
  return svgEl("svg", {
    viewBox: `0 0 ${width} ${height}`,
    role: "img",
    "aria-hidden": "true",
  });
}

function svgEl(tagName, attrs = {}, textContent = null) {
  const element = document.createElementNS(svgNs, tagName);
  Object.entries(attrs).forEach(([name, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      element.setAttribute(name, String(value));
    }
  });
  if (textContent !== null) {
    element.textContent = textContent;
  }
  return element;
}

function formatCurrency(value) {
  return currency.format(Math.round(value));
}

function signedCurrency(value) {
  const rounded = Math.round(value);
  if (rounded === 0) {
    return currency.format(0);
  }
  return `${rounded > 0 ? "+" : "-"}${currency.format(Math.abs(rounded))}`;
}

function interpolateColor(value, minValue, maxValue) {
  if (maxValue === minValue) {
    return cepa.blue;
  }
  const t = (value - minValue) / (maxValue - minValue);
  const start = [241, 246, 255];
  const mid = [101, 207, 233];
  const end = [0, 39, 118];

  const color = t < 0.55
    ? mix(start, mid, t / 0.55)
    : mix(mid, end, (t - 0.55) / 0.45);
  return `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
}

function mix(a, b, t) {
  return a.map((value, index) => Math.round(value + (b[index] - value) * t));
}

function debounce(fn, wait) {
  let timer = null;
  return () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(), wait);
  };
}
