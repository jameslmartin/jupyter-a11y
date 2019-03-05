# Jupyter a11y Project
An accessibility extension for the Jupyter project

Click to view details of this project on [GitHub Pages](http://jameslmartin.github.io/jupyter-a11y/).

### Installation
Include the following code in your notebook to download the extension to your `nbextensions` folder:
```python
import notebook.nbextensions
nbreader = 'https://raw.githubusercontent.com/jameslmartin/jupyter-a11y/master/nbreader.js'
notebook.nbextensions.install_nbextension(nbreader, user=True)
```
Then run the following JavaScript cell using magics to load the `reader` extension:
```python
%%javascript
Jupyter.utils.load_extensions('nbreader')
```
To persist `nbreader` across notebooks, modify your Jupyter configuration file as follows:
```python'
from notebook.services.config import ConfigManager
ip = get_ipython()
cm = ConfigManager(parent=ip, profile_dir=ip.profile_dir.location)
cm.update('notebook', {"load_extensions": {"nbreader": True}})
```
