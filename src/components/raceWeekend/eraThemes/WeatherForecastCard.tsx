import type { WeekendForecast } from '../../../sim/weatherEngine';
import { weatherRows } from './raceWeekendHubData';

type Props = {
  forecast: WeekendForecast;
  onOpenForecast: () => void;
};

export function WeatherForecastCard({ forecast, onOpenForecast }: Props) {
  return (
    <section className="f1-1990s-panel min-h-[204px]" aria-label="Weather forecast">
      <header className="f1-1990s-panel-title">Weather Forecast</header>
      <div className="grid grid-cols-3 gap-2 text-center">
        {weatherRows(forecast).map((row) => (
          <div key={row.session} className="rounded border border-neutral-800 bg-black/20 px-2 py-2">
            <div className="text-[10px] font-bold text-neutral-400">{row.day}</div>
            <div className="mt-2 text-xl text-amber-300">{weatherIcon(row.weather.condition)}</div>
            <div className="mt-1 text-[11px] text-neutral-200">{row.weather.label}</div>
            <div className="mt-1 font-mono text-[11px] text-neutral-500">
              {row.weather.wet ? 'Rain risk' : row.weather.changingSoon ? 'Changeable' : 'Stable'}
            </div>
          </div>
        ))}
      </div>
      <button type="button" className="f1-1990s-secondary-button mt-3 w-full" onClick={onOpenForecast}>
        Detailed Forecast
      </button>
    </section>
  );
}

function weatherIcon(condition: string): string {
  if (condition === 'LightRain') return 'RAIN';
  if (condition === 'HeavyRain') return 'WET';
  if (condition === 'Cloudy' || condition === 'Changeable') return 'CLOUD';
  if (condition === 'Drying') return 'DRYING';
  return 'SUN';
}
