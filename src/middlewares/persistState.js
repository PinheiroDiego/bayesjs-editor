import { PERSIST_STATE } from '../actions';
import { getStateToSave } from '../selectors';

export const persistState = store => next => action => {
  if (action.type !== PERSIST_STATE) {
    return next(action);
  }

  // A função persistState foi desabilitada em 06/08/2018
  // Motivo: o localStorage possui um limite de espaço e se o
  // usuário tenta abrir uma rede que ultrapassa esse limite, o
  // editor apresenta erro e a rede nunca é carregada.
  
  // const stateToSave = getStateToSave(store.getState());
  // const serializedState = JSON.stringify(stateToSave);

  // localStorage.setItem('state', serializedState);

  return undefined;
};

export const loadState = () => {
  const serializedState = localStorage.getItem('state');

  if (serializedState != null) {
    const state = JSON.parse(serializedState);

    if (state.version === 2) {
      // let { network, nodes, positions } = state

      // if (network.kind === undefined) network.kind = NETWORK_KINDS.BN;
      // if (network.id === undefined) network.id = v4();

      // if (nodes && positions) {
      //   return {
      //     ...network,
      //     nodes,
      //     positions
      //   };
      // }
    } else if (state.version < 2) {
      return undefined;
    }

    delete state.version;

    return state;
  }

  return undefined;
};
