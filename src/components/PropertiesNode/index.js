import React, { Component, PropTypes } from 'react';
import { connect } from 'react-redux';
import { changeNodeId, changeNodeDescription, changeNodeType } from '../../actions';
import { getNodes } from '../../selectors';
import Button from '../Button';
import styles from './styles.css';

class PropertiesNode extends Component {
  constructor(props) {
    super(props);
    const { node } = props;

    this.state = {
      inputText: node.id,
      nodeDescription: node.description || '',
    };
  }

  componentWillReceiveProps(nextProps) {
    const { id, description } = nextProps.node;

    this.setState({
      inputText: id,
      nodeDescription: description || '',
    });
  }

  handleOnChange = (e) => {
    const { value, id } = e.target;

    if (id === 'description') {
      this.setState({ nodeDescription: value });
    } else if (id === 'name') {
      this.setState({ inputText: value });
    } else if (id === 'type') {
      this.setState({ type: value });
    }
  };

  handleNodeNameBlur = (e) => {
    const { node, nodes, dispatch } = this.props;
    const input = e.target;
    const id = node.id;
    const nextId = this.state.inputText;

    const alreadyExits = nodes
      .filter(x => x.id !== id)
      .some(x => x.id === nextId);

    if (nextId === '' || alreadyExits) {
      input.value = id;
    } else {
      dispatch(changeNodeId(id, nextId));
    }
  };

  handleNodeDescripionBlur = (e) => {
    const { node, dispatch } = this.props;
    const { value } = e.target;
    const { id } = node;

    dispatch(changeNodeDescription(id, value));
  };

  handleNodeTypeBlur = (e) => {
    const { node, dispatch } = this.props;
    const { value } = e.target;
    const { id } = node;

    dispatch(changeNodeType(id, value));
  };

  handleKeyUpDescription = (e) => {
    const key = e.keyCode || e.which;

    if (key === 13) {
      this.handleNodeDescripionBlur(e);
    }
  };

  render() {
    const { node } = this.props;

    return (
      <div>
        <h2>Propriedades da Variável</h2>

        <div className={styles.fieldWrapper}>
          <label htmlFor="name">Nome</label>
          <input
            id="name"
            type="text"
            value={this.state.inputText}
            onChange={this.handleOnChange}
            onBlur={this.handleNodeNameBlur}
          />
        </div>

        <div className={styles.fieldWrapper}>
          <label htmlFor="type">Tipo do Nodo</label>
          <select
            id="type"
            style={{ width: '100%' }}
            value={this.state.node}
            onChange={this.handleOnChange}
            onBlur={this.handleNodeTypeBlur}
          >
            <option value="">Selecione uma opção</option>
            <option value="Fator relacionado">Fator relacionado</option>
            <option value="População em risco">População em risco</option>
            <option value="Condição associada">Condição associada</option>
            <option value="Característica definidora">Característica definidora</option>
            <option value="Diagnóstico de enfermagem">Diagnóstico de enfermagem</option>
            <option value="Intervenção de enfermagem">Intervenção de enfermagem</option>
            <option value="Outro diagnóstico">Outro diagnóstico</option>
            <option value="Realizar outro diagnóstico">Realizar outro diagnóstico</option>
          </select>
        </div>

        <div className={styles.fieldWrapper}>
          <label htmlFor="description">Descrição</label>
          <textarea
            id="description"
            value={this.state.nodeDescription}
            onChange={this.handleOnChange}
            onBlur={this.handleNodeDescripionBlur}
          />
        </div>

        <div className={styles.fieldWrapper}>
          <Button onClick={() => this.props.onEditNodeStates(node)}>
            Editar estados
          </Button>
        </div>

        <div className={styles.fieldWrapper}>
          <Button onClick={() => this.props.onEditNodeCpt(node)}>
            Editar probabilidades
          </Button>
        </div>
      </div>
    );
  }
}

PropertiesNode.propTypes = {
  node: PropTypes.object.isRequired,
  onEditNodeStates: PropTypes.func.isRequired,
  onEditNodeCpt: PropTypes.func.isRequired,
};

const mapStateToProps = state => ({
  nodes: getNodes(state),
});


export default connect(mapStateToProps)(PropertiesNode);
