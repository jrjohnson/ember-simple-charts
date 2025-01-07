import 'd3-transition';
import { cached, tracked } from '@glimmer/tracking';
import Component from '@glimmer/component';
import { select } from 'd3-selection';
import { hierarchy, pack } from 'd3-hierarchy';
import { interpolateSinebow } from 'd3-scale-chromatic';
import { scaleSequential } from 'd3-scale';
import { TrackedAsyncData } from 'ember-async-data';
import { timeout, restartableTask } from 'ember-concurrency';

export default class SimpleChartPack extends Component {
  @tracked element = null;

  @cached
  get isPaintedData() {
    return new TrackedAsyncData(
      this.paint.perform(
        this.element,
        this.args.data,
        this.args.containerHeight,
        this.args.containerWidth,
        this.args.isIcon,
        this.args.isClickable,
        this.args.hover,
        this.args.leave,
        this.args.onClick,
      ),
    );
  }

  get isPainted() {
    return this.isPaintedData.isResolved;
  }

  paint = restartableTask(
    async (
      element,
      data,
      containerHeight,
      containerWidth,
      isIcon,
      isClickable,
      hover,
      leave,
      onClick,
    ) => {
      await timeout(1); //wait a beat to let the loading value settle
      const height = Math.min(containerHeight, containerWidth) || 0;
      const width = Math.min(containerHeight, containerWidth) || 0;
      const dataOrEmptyObject = data ? data : {};
      const svg = select(element);

      const packLayout = pack()
        .size([height - 15, width - 15])
        .padding(10);
      const rootNode = hierarchy(dataOrEmptyObject);
      rootNode.sum((d) => d.value);
      packLayout(rootNode);
      const color = scaleSequential(interpolateSinebow).domain([
        0,
        rootNode.value,
      ]);

      svg.selectAll('.chart').remove();
      const chart = svg.append('g').attr('class', 'chart');

      const nodes = chart
        .selectAll('circle')
        .data(rootNode.descendants())
        .enter()
        .append('circle')
        .classed('node', true)
        .attr('fill', (d) => color(d.value))
        .attr('cx', (d) => d.x)
        .attr('cy', (d) => d.y)
        .attr('r', (d) => d.r);

      if (!isIcon) {
        chart
          .selectAll('circle')
          .filter((d) => d.data.description)
          .append('desc')
          .text((d) => d.data.description);

        nodes.on('mouseenter', ({ target }) => {
          const { data } = select(target).datum();
          const elements = chart.selectAll('circle.node');
          const selectedElement = elements.filter(({ data: nodeData }) => {
            return nodeData.name === data.name;
          });
          hover(data, selectedElement.node());
        });
        nodes.on('mouseleave', leave);

        if (isClickable) {
          nodes.on('click', ({ target }) => {
            const { data } = select(target).datum();
            onClick(data);
          });
          nodes.style('cursor', 'pointer');
        }
      }
    },
  );
}
