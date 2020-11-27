(function(){
  window.ui = window.ui || {}
  ui.flipletCharts = ui.flipletCharts || {};

  Fliplet.Chart = Fliplet.Widget.Namespace('chart');

  function init() {
    Fliplet.Widget.instance('chart-line-1-1-0', function (data) {
      var chartId = data.id;
      var chartUuid = data.uuid;
      var $container = $(this);
      var inheritColor1 = true;
      var inheritColor2 = true;
      var refreshTimeout = 5000;
      var refreshTimer;
      var updateDateFormat = 'hh:mm:ss a';
      var colors = [
        '#00abd1', '#ed9119', '#7D4B79', '#F05865', '#36344C',
        '#474975', '#8D8EA6', '#FF5722', '#009688', '#E91E63'
      ];
      var chartInstance;

      var chartReady;
      var chartPromise = new Promise(function(resolve) {
        chartReady = resolve;
      });

      function resetData() {
        data.entries = [];
        data.totalEntries = 0;
      }

      function refreshData() {
        if (typeof data.dataSourceQuery !== 'object') {
          data.entries = [
            {x: 1, y: 2},
            {x: 2, y: 1.5},
            {x: 3, y: 4},
            {x: 4, y: 1},
            {x: 5, y: 2},
            {x: 6, y: 2.5}
          ];
          data.xAxisTitle = 'X-axis';
          data.yAxisTitle = 'Y-axis';
          data.totalEntries = 6;
          return Promise.resolve()
        }

        // beforeQueryChart is deprecated
        return Fliplet.Hooks.run('beforeQueryChart', data.dataSourceQuery).then(function() {
          return Fliplet.Hooks.run('beforeChartQuery', {
            config: data,
            id: data.id,
            uuid: data.uuid,
            type: 'line'
          });
        }).then(function() {
          if (_.isFunction(data.getData)) {
            var response = data.getData();

            if (!(response instanceof Promise)) {
              return Promise.resolve(response);
            }

            return response;
          }

          return Fliplet.DataSources.fetchWithOptions(data.dataSourceQuery);
        }).then(function(result){
          // afterQueryChart is deprecated
          return Fliplet.Hooks.run('afterQueryChart', result).then(function () {
            return Fliplet.Hooks.run('afterChartQuery', {
              config: data,
              id: data.id,
              uuid: data.uuid,
              type: 'line',
              records: result
            });
          }).then(function () {
            resetData();
            if (result.dataSource.columns.indexOf(data.dataSourceQuery.columns.xAxis) < 0 || result.dataSource.columns.indexOf(data.dataSourceQuery.columns.yAxis) < 0) {
              return Promise.resolve();
            }
            result.dataSourceEntries.forEach(function(row) {
              var x;
              if (data.dataFormat === 'timestamp') {
                x = new Date(row[data.dataSourceQuery.columns.xAxis] || 0).getTime()
              } else {
                x = parseInt(row[data.dataSourceQuery.columns.xAxis], 10) || 0;
              }
              var y = parseInt(row[data.dataSourceQuery.columns.yAxis], 10) || 0;
              data.entries.push([x, y]);
            });
            data.entries = _.sortBy(data.entries, function(entry){
              return entry[0];
            });
            // SAVES THE TOTAL NUMBER OF ROW/ENTRIES
            data.totalEntries = data.entries.length;

            return Promise.resolve();
          }).catch(function(error){
            return Promise.reject(error);
          });
        })
      }

      function refreshChartInfo() {
        // Update total count
        $container.find('.total').html(data.totalEntries);
        // Update last updated time
        $container.find('.updatedAt').html(moment().format(updateDateFormat));
      }

      function refreshChart() {
        // Retrieve chart object
        var chart = ui.flipletCharts[chartId];

        if (!chart) {
          return drawChart();
        }

        // Update values
        chart.series[0].setData(data.entries);
        refreshChartInfo();
        return Promise.resolve(chart);
      }

      function refresh() {
        if (refreshTimer) {
          clearTimeout(refreshTimer);
          refreshTimer = null;
        }

        return refreshData().then(function () {
          if (data.autoRefresh) {
            setRefreshTimer();
          }

          return refreshChart();
        }).catch(function (err) {
          if (data.autoRefresh) {
            setRefreshTimer();
          }

          return Promise.reject(err);
        });
      }

      function setRefreshTimer() {
        if (refreshTimer) {
          clearTimeout(refreshTimer);
        }

        refreshTimer = setTimeout(refresh, refreshTimeout);
      }

      function inheritColor(inheritanceColorKey, colorsArray, colorIndex) {
        var inheritanceColor = Fliplet.Themes.Current.get(inheritanceColorKey);

        if (inheritanceColor) {
          colorsArray[colorIndex] = inheritanceColor;
        }
      }

      Fliplet.Studio.onEvent(function(event) {
        var eventDetail = event.detail;

        if (eventDetail && eventDetail.type === 'colorChange') {
          var colorIndex = null;

          switch (eventDetail.label) {
            case 'Highlight color':
              if (inheritColor1) {
                colorIndex = 0;
              }

              break;
            case 'Secondary color':
              if (inheritColor2) {
                colorIndex = 1;
              }

              break;
            case 'Chart color 1':
              inheritColor1 = false;

              break;
            case 'Chart color 2':
              inheritColor2 = false;

              break;
            default:
              break;
          }

          if (colorIndex === null) {
            var labelIndex = eventDetail.label.match(/[0-9]{1,2}/);

            if (labelIndex === null) {
              return;
            }

            colorIndex = labelIndex[0] - 1;
          }

          colors[colorIndex] = eventDetail.color;

          chartInstance.update({
            colors: colors
          });
        }
      });

      function drawChart() {
        return new Promise(function (resolve, reject) {
          var customColors = Fliplet.Themes.Current.getSettingsForWidgetInstance(chartUuid);

          colors.forEach(function eachColor(color, index) {
            if (!Fliplet.Themes) {
              return;
            }

            var colorKey = 'chartColor' + (index + 1);
            var newColor = customColors
              ? customColors.values[colorKey]
              : Fliplet.Themes.Current.get(colorKey);

            if (newColor) {
              colors[index] = newColor;
              inheritColor1 = colorKey !== 'chartColor1';
              inheritColor2 = colorKey !== 'chartColor2';
            } else if (colorKey === 'chartColor1' && inheritColor1) {
              inheritColor('highlightColor', colors, index);
            } else if (colorKey === 'chartColor2' && inheritColor2) {
              inheritColor('secondaryColor', colors, index);
            }
          });
          var chartOpt = {
            chart: {
              type: 'line',
              zoomType: 'xy',
              renderTo: $container.find('.chart-container')[0],
              style: {
                fontFamily: (Fliplet.Themes && Fliplet.Themes.Current.get('bodyFontFamily')) || 'sans-serif'
              },
              events: {
                load: function(){
                  refreshChartInfo();
                  if (data.autoRefresh) {
                    setRefreshTimer();
                  }
                },
                render: function () {
                  ui.flipletCharts[chartId] = this;
                  Fliplet.Hooks.run('afterChartRender', {
                    chart: ui.flipletCharts[chartId],
                    chartOptions: chartOpt,
                    id: data.id,
                    uuid: data.uuid,
                    type: 'line',
                    config: data
                  });
                  resolve(this);
                }
              }
            },
            colors: colors,
            title: {
              text: ''
            },
            subtitle: {
              text: ''
            },
            xAxis: {
              title: {
                text: data.xAxisTitle || data.dataSourceQuery.columns.xAxis,
                enabled: data.xAxisTitle !== ''
              },
              labels: {
                formatter: function(){
                  if (data.dataFormat === 'timestamp') {
                    return moment(this.value).format('YYYY-MM-DD');
                  }
                  return this.value;
                }
              },
              startOnTick: true,
              endOnTick: true,
              showLastLabel: true
            },
            yAxis: {
              title: {
                text: data.yAxisTitle || data.dataSourceQuery.columns.yAxis,
                enabled: data.yAxisTitle !== ''
              }
            },
            navigation: {
              buttonOptions: {
                enabled: false
              }
            },
            tooltip: {
              enabled: data.showDataValues,
              headerFormat: '',
              pointFormat: [
                '<strong>',
                (data.xAxisTitle !== ''
                  ? data.xAxisTitle
                  : data.dataSourceQuery.columns.xAxis),
                '</strong> ',
                (data.dataFormat === 'timestamp'
                  ? '{point.x:%Y-%m-%d %H:%M:%S}'
                  : '{point.x}'),
                '<br><strong>',
                (data.yAxisTitle !== ''
                  ? data.yAxisTitle
                  : data.dataSourceQuery.columns.yAxis),
                '</strong>: {point.y}'
              ].join('')
            },
            series: [{
              data: data.entries,
              events: {
                click: function () {
                  Fliplet.Analytics.trackEvent({
                    category: 'chart',
                    action: 'data_point_interact',
                    label: 'line'
                  });
                },
                legendItemClick: function () {
                  Fliplet.Analytics.trackEvent({
                    category: 'chart',
                    action: 'legend_filter',
                    label: 'line'
                  });
                }
              }
            }],
            legend: {
              enabled: false
            },
            credits: {
              enabled: false
            }
          };
          // Create and save chart object
          Fliplet.Hooks.run('beforeChartRender', {
            chartOptions: chartOpt,
            id: data.id,
            uuid: data.uuid,
            type: 'line',
            config: data
          }).then(function () {
            try {
              chartInstance = new Highcharts.Chart(chartOpt);
            } catch (e) {
              return Promise.reject(e);
            }
          }).catch(reject);
        });
      }

      function redrawChart() {
        ui.flipletCharts[chartId].reflow();
      }

      if (Fliplet.Env.get('interact')) {
        // TinyMCE removes <style> tags, so we've used a <script> tag instead,
        // which will be appended to <body> to apply the styles
        $($(this).find('.chart-styles').detach().html()).appendTo('body');
      } else {
        $(this).find('.chart-styles').remove();
      }

      Fliplet.Hooks.on('appearanceChanged', redrawChart);
      Fliplet.Hooks.on('appearanceFileChanged', redrawChart);

      refreshData().then(drawChart).catch(function(error){
        console.error(error);
        setRefreshTimer();
      });

      Fliplet.Chart.add(chartPromise);

      chartReady({
        name: data.chartName,
        type: 'line',
        refresh: refresh
      });
    });
  }

  Fliplet().then(function(){
    var debounceLoad = _.debounce(init, 500, { leading: true });
    Fliplet.Studio.onEvent(function (event) {
      if (event.detail.event === 'reload-widget-instance') {
        debounceLoad();
      }
    });

    init();
  });
})();
