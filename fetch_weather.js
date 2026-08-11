const axios = require('axios');
const fs = require('fs');
const lunar = require('lunar-javascript');

// ========== 配置 ==========
const LAT = 34.43304;
const LON = 112.413687;
const CITY = '伊川县西仓村';
const TIMEZONE = 'Asia/Shanghai';

// 天气代码 → 中文描述映射
const WEATHER_MAP = {
  0: '晴', 1: '晴间多云', 2: '多云', 3: '阴',
  45: '雾', 48: '雾',
  51: '小毛毛雨', 53: '毛毛雨', 55: '大毛毛雨',
  56: '冻毛毛雨', 57: '冻大毛毛雨',
  61: '小雨', 63: '中雨', 65: '大雨',
  66: '冻雨', 67: '冻大雨',
  71: '小雪', 73: '中雪', 75: '大雪',
  77: '雪粒',
  80: '阵雨', 81: '中阵雨', 82: '大阵雨',
  85: '小阵雪', 86: '大阵雪',
  95: '雷暴', 96: '雷暴加冰雹', 99: '强雷暴加冰雹'
};

// ========== 工具函数 ==========
// 获取今天的日期（强制使用北京时间）
function getToday() {
  const d = new Date();
  const beijingDate = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
  return beijingDate;
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getLunarDate(date) {
  const solar = lunar.Solar.fromDate(date);
  const lunarObj = solar.getLunar();
  const month = lunarObj.getMonthInChinese();
  const day = lunarObj.getDayInChinese();
  return `${month}月${day}`;
}

function isTodayRecorded(dateStr) {
  if (!fs.existsSync('weather.csv')) return false;
  const content = fs.readFileSync('weather.csv', 'utf-8');
  const lines = content.split('\n');
  if (lines.length < 2) return false;
  const lastLine = lines[lines.length - 2];
  return lastLine.startsWith(dateStr);
}

function weatherCodeToText(code) {
  return WEATHER_MAP[code] || `未知(${code})`;
}

// ========== 主函数 ==========
async function main() {
  const today = getToday();
  const dateStr = formatDate(today);
  
  // 检查是否已记录
  if (isTodayRecorded(dateStr)) {
    console.log(`✅ ${dateStr} 已存在，跳过`);
    return;
  }
  
  console.log(`📡 正在从 Open-Meteo 抓取 ${dateStr} 的天气数据...`);
  
  try {
    // ----- 1. 获取预报数据（今天） -----
    const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_sum,wind_speed_10m_max,relative_humidity_2m_mean,pressure_msl_mean&timezone=${TIMEZONE}&forecast_days=1`;
    
    const forecastRes = await axios.get(forecastUrl);
    const forecastData = forecastRes.data;
    
    if (!forecastData.daily || !forecastData.daily.time || forecastData.daily.time.length === 0) {
      throw new Error('预报API返回数据为空');
    }
    
    const daily = forecastData.daily;
    
    // ----- 2. 获取天气状况 -----
    let weatherText = '获取中';
    try {
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&daily=weathercode&timezone=${TIMEZONE}&forecast_days=1`;
      const weatherRes = await axios.get(weatherUrl);
      const weatherData = weatherRes.data;
      if (weatherData.daily && weatherData.daily.weathercode && weatherData.daily.weathercode.length > 0) {
        const weatherCode = weatherData.daily.weathercode[0];
        weatherText = weatherCodeToText(weatherCode);
        console.log(`  天气状况: ${weatherText} (代码 ${weatherCode})`);
      }
    } catch (weatherErr) {
      console.warn('  获取天气状况失败:', weatherErr.message);
    }
    
    // ----- 3. 获取农历 -----
    const lunarDate = getLunarDate(today);
    
    // ----- 4. 组装记录 -----
    const record = {
      date: daily.time[0],
      lunar: lunarDate,
      city: CITY,
      maxTemp: daily.temperature_2m_max[0] ?? '-',
      minTemp: daily.temperature_2m_min[0] ?? '-',
      sunrise: daily.sunrise[0] ? daily.sunrise[0].split('T')[1] : '-',
      sunset: daily.sunset[0] ? daily.sunset[0].split('T')[1] : '-',
      weather: weatherText,
      precip: daily.precipitation_sum[0] ?? '0.0',
      windSpeed: daily.wind_speed_10m_max[0] ?? '-',
      humidity: daily.relative_humidity_2m_mean[0] ?? '-',
      pressure: daily.pressure_msl_mean[0] ?? '-'
    };
    
    // ----- 5. 写入CSV -----
    const line = [
      record.date, record.lunar, record.city,
      record.maxTemp, record.minTemp,
      record.sunrise, record.sunset,
      record.weather, record.precip,
      record.windSpeed, record.humidity, record.pressure
    ].join('\t');
    
    if (!fs.existsSync('weather.csv')) {
      const header = [
        '公历日期', '农历日期', '城市', '最高气温(℃)', '最低气温(℃)',
        '日出时间', '日落时间', '天气状况', '降水量(mm)',
        '最大风速(km/h)', '平均相对湿度(%)', '气压(hPa)'
      ].join('\t');
      fs.writeFileSync('weather.csv', header + '\n');
    }
    
    fs.appendFileSync('weather.csv', line + '\n');
    console.log(`✅ 成功追加 ${dateStr} 数据`);
    
  } catch (error) {
    console.error('❌ 抓取失败:', error.message);
    if (error.response) {
      console.error('API响应:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

main();
