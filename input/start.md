# pip install -e

## 把pyproject.toml中的entry-points写入venv对应的txt

# ./launch_lhcae.py

## 创建Application对象

## 初始化Application对象

### load_modules

1. load_entries加载模块：importlib.metadata.entry_points()从venv查找对应txt得到入口点，返回ModuleEntry，得到list[ModuleEntry]，写入Application.registry。
2. _load_factory_entries加载导入器、导出器和求解器：同上，写入Application.registry.importers/Application.registry.exporters/Application.registry.solvers

## 依赖Application run_gui

### 创建QApplication

### build_gui

#### 创建GuiApplication
创建投影用组件
#### load_gui_modules
加载GUI组件
#### 创建QtMainWindowAdapter
创建实际QT组件
#### adapter.render()

### qt_app.exec()

