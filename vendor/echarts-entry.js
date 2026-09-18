/** ECharts custom build: only the modules the usage trend chart needs. */
import * as echarts from 'echarts/core'
import { BarChart, LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent, MarkLineComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

// MarkLineComponent draws the daily-average reference line; without it a
// `markLine` option is silently dropped from the option object.
echarts.use([BarChart, LineChart, GridComponent, TooltipComponent, LegendComponent, MarkLineComponent, CanvasRenderer])
globalThis.__DSHTU_ECHARTS__ = echarts
