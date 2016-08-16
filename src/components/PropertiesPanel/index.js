import React, { Component, PropTypes } from 'react';
import { connect } from 'react-redux';
import { changeNetworkProperty, changeNodeId } from '../../actions';
import { getNetwork, getSelectedNode } from '../../selectors';
import classNames from 'classnames';
import Button from '../Button';
import EditStates from '../EditStates';
import styles from './styles.css';

class PropertiesPanel extends Component {
  state = {
    showing: true,
    editingNodeStates: null,
  };

  handleToggleClick = () => {
    this.setState({ showing: !this.state.showing });
  };

  handleNetworkNameBlur = e => {
    const name = e.target.id;
    const value = e.target.value;
    this.props.dispatch(changeNetworkProperty(name, value));
  };

  handleNetworkSizeBlur = e => {
    const input = e.target;
    const name = input.id;
    const value = parseInt(input.value, 10);

    if (isNaN(value)) {
      input.value = this.props.network[name];
    } else {
      this.props.dispatch(changeNetworkProperty(name, value));
    }
  };

  handleNodeNameBlur = e => {
    const id = this.props.selectedNode.id;
    const nextId = e.target.value;
    this.props.dispatch(changeNodeId(id, nextId));
  }

  renderNetworkProperties() {
    return (
      <div>
        <h2>Propriedades da Rede</h2>

        <div className={styles.fieldWrapper}>
          <label htmlFor="name">Nome</label>
          <input
            id="name"
            type="text"
            defaultValue={this.props.network.name}
            onBlur={this.handleNetworkNameBlur}
          />
        </div>

        <div className={styles.fieldWrapper}>
          <label htmlFor="height">Altura</label>
          <input
            id="height"
            type="text"
            defaultValue={this.props.network.height}
            onBlur={this.handleNetworkSizeBlur}
          />
        </div>

        <div className={styles.fieldWrapper}>
          <label htmlFor="width">Largura</label>
          <input
            id="width"
            type="text"
            defaultValue={this.props.network.width}
            onBlur={this.handleNetworkSizeBlur}
          />
        </div>
      </div>
    );
  }

  renderCptWithoutParents(cpt) {
    const states = Object.keys(cpt);

    return (
      <table className={styles.cpt}>
        <thead>
          <tr>
            {states.map(state => (
              <th key={state}>{state}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {states.map(state => (
              <td key={state}>{cpt[state]}</td>
            ))}
          </tr>
        </tbody>
      </table>
    );
  }

  renderCptWithParents(cpt) {
    const parents = Object.keys(cpt[0].when);
    const states = Object.keys(cpt[0].then);

    const firstStateCellStyle = {
      borderLeft: 'solid 1px black',
      paddingLeft: '10px',
    };

    return (
      <table className={styles.cpt}>
        <thead>
          <tr>
            {parents.map(parent => (
              <th key={parent}>{parent}</th>
            ))}
            {states.map((state, stateIndex) => (
              <th key={state} style={stateIndex === 0 ? firstStateCellStyle : null}>
                {state}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cpt.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {parents.map(parent => (
                <td key={parent}>{row.when[parent]}</td>
              ))}
              {states.map((state, stateIndex) => (
                <td key={state} style={stateIndex === 0 ? firstStateCellStyle : null}>
                  {row.then[state]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  renderSelectedNodeProperties() {
    const node = this.props.selectedNode;

    return (
      <div key={node.id}>
        <h2>Propriedades da Variável</h2>

        <div className={styles.fieldWrapper}>
          <label htmlFor="name">Nome</label>
          <input
            id="name"
            type="text"
            defaultValue={node.id}
            onBlur={this.handleNodeNameBlur}
          />
        </div>

        <div className={styles.fieldWrapper}>
          <label>Estados</label>
          <ul>
            {node.states.map(state => (
              <li key={state}>{state}</li>
            ))}
          </ul>
          <Button onClick={() => this.setState({ editingNodeStates: node })}>
            Editar
          </Button>
        </div>

        <div className={styles.fieldWrapper}>
          <label>Tabela de Probabilidades</label>
          {node.parents.length === 0 ? (
            this.renderCptWithoutParents(node.cpt)
          ) : (
            this.renderCptWithParents(node.cpt)
          )}
          <Button onClick={() => console.log('¯\\_(ツ)_/¯')}>
            Editar
          </Button>
        </div>
      </div>
    );
  }

  render() {
    return (
      <div
        className={classNames({
          [styles.panel]: true,
          [styles.panelShown]: this.state.showing,
        })}
      >
        <Button
          className={styles.toggleButton}
          onClick={this.handleToggleClick}
        >
          <i className="fa fa-sliders" />Propriedades
        </Button>

        <div className={styles.content}>
          {this.props.selectedNode === null ? (
            this.renderNetworkProperties()
          ) : (
            this.renderSelectedNodeProperties()
          )}
        </div>

        <EditStates
          node={this.state.editingNodeStates}
          onRequestClose={() => this.setState({ editingNodeStates: null })}
        />
      </div>
    );
  }
}

PropertiesPanel.propTypes = {
  dispatch: PropTypes.func.isRequired,
  network: PropTypes.object.isRequired,
  selectedNode: PropTypes.object,
};

const mapStateToProps = state => ({
  network: getNetwork(state),
  selectedNode: getSelectedNode(state),
});

export default connect(mapStateToProps)(PropertiesPanel);