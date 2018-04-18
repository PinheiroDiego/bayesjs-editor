import fileDownload from 'react-file-download';

export const openFile = (accept, cb) => {
  const element = document.createElement('input');

  element.setAttribute('type', 'file');
  element.setAttribute('accept', accept);

  element.addEventListener('change', e => {
    const file = e.target.files[0];
    const reader = new FileReader();

    reader.onloadend = () => {
      cb(reader.result);
    };

    reader.onerror = () => {
      alert('Error on open file');
    };

    reader.readAsText(file);
  });

  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
};

export const saveFile = (filename, text) => {
  fileDownload(text, filename);
};
