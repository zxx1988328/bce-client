/**
 * Component - Url Component
 *
 * @file Url.js
 * @author mudio(job.mudio@gmail.com)
 */

/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */

import _ from 'lodash';
import path from 'path';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import classnames from 'classnames';
import React, {Component} from 'react';

import styles from './Navigator.css';
import logger from '../../../utils/logger';
import SystemBar from '../common/SystemBar';
import {ClientFactory} from '../../api/client';
import {getLocalText} from '../../../utils/region';
import GlobalConfig from '../../../main/ConfigManager';

const endpoint = GlobalConfig.get('endpoint');
const supportRegions = Object.keys(endpoint);

class Navigator extends Component {
    static propTypes = {
        bucket: PropTypes.string,
        prefix: PropTypes.string,
        region: PropTypes.string.isRequired,
        redirect: PropTypes.func.isRequired
    };

    constructor(props, ...args) {
        super(props, ...args);

        this.state = {
            focus: false, value: '', history: [], records: [], index: -1
        };

        this.invokeQuery = _.debounce(this._query, 300);
    }

    componentWillReceiveProps(nextProps) {
        const {bucket, prefix} = nextProps;
        if (bucket !== this.props.bucket || prefix !== this.props.prefix) {
            this.setState({value: '', focus: false});
        }
    }

    _resolveSelectItem(value = '') {
        const [bucket, ...prefixs] = value.trim().split('/');

        if (prefixs.length === 0) {
            return {bucket};
        }

        return {bucket, prefix: prefixs.join('/')};
    }

    /**
     * 查询匹配
     *
     * @memberOf Navigator
     */
    async _query() {
        const {value} = this.state;
        const {region, bucket, prefix = '', redirect} = this.props;

        if (bucket) {
            redirect({region, bucket, prefix, search: value});
            return;
        }

        const _client = ClientFactory.fromRegion(region);
        try {
            const {buckets} = await _client.listBuckets();
            const records = buckets.reduce((context = [], item) => {
                if (item.name.indexOf(value) > -1) {
                    context.push({
                        region: item.location,
                        bucket: item.name
                    });
                }
                return context;
            }, []);

            this.setState({records, index: -1});
        } catch (ex) {
            logger.info(ex.message);
        }
    }

    _onChange = evt => {
        this.setState({value: evt.target.value});
        this.invokeQuery();
    }

    _onKeyDown(event) {
        if (event.key === 'ArrowUp') {
            let {index} = this.state;
            const {records} = this.state;

            if (index <= 0) {
                index = this.state.records.length;
            }

            const {bucket, prefix = ''} = records[index - 1];
            this.setState({
                index: index - 1,
                value: path.posix.join(bucket, prefix, '/')
            });
            event.preventDefault();
        } else if (event.key === 'ArrowDown') {
            let {index} = this.state;
            const {records} = this.state;

            if (index >= this.state.records.length - 1) {
                index = -1;
            }

            const {bucket, prefix = ''} = records[index + 1];
            this.setState({
                index: index + 1,
                value: path.posix.join(bucket, prefix, '/')
            });
            event.preventDefault();
        }
    }

    _onBlur = () => {
        const {value} = this.state;

        if (!value.trim()) {
            this.setState({records: [], index: -1, focus: false});
            return;
        }

        this.setState({records: [], index: -1});
    }

    _onFocus = () => {
        this.setState({focus: true});
    }

    _onSearch = () => {
        const {focus} = this.state;
        const {region, bucket, prefix, redirect} = this.props;

        if (focus) {
            this.setState({value: '', focus: false});
            redirect({region, bucket, prefix});
        } else {
            this.setState({focus: true});
        }
    }

    _selectRegion(selectRegion) {
        const {region, redirect} = this.props;

        if (region !== selectRegion) {
            redirect({region: selectRegion});
        }
    }

    _selectMatched(selectIndex) {
        const {records} = this.state;
        const {redirect} = this.props;
        const {region, bucket, prefix} = records[selectIndex];

        if (this.props.bucket !== bucket || this.props.prefix !== prefix) {
            redirect({region, bucket, prefix});
        }
    }

    forward = () => {
        const {redirect} = this.props;
        const {region, bucket, prefix} = this.state.history.pop();

        redirect({region, bucket, prefix});
    }

    backward = () => {
        const {redirect, region} = this.props;
        const {value, history} = this.state;
        const {bucket, prefix = ''} = this._resolveSelectItem(value);
        let prefixs = prefix.split('/');

        this.setState({history: [{region, bucket, prefix}, ...history]});

        if (prefixs.length >= 2) {
            prefixs = prefixs.slice(0, prefixs.length - 2);

            if (prefixs.length === 0) {
                return redirect({region, bucket});
            }

            prefixs.push('');
            return redirect({region, bucket, prefix: prefixs.join('/')});
        }

        redirect({region});
    }

    _redirect = (regionName, bucketName, prefixs = []) => {
        const {region, bucket, redirect} = this.props;

        redirect({
            region: regionName || region,
            bucket: bucketName || bucket,
            prefix: prefixs.join('/')
        });
    }

    renderSearch() {
        const {focus, value} = this.state;
        const {region, bucket, prefix = ''} = this.props;

        const searchStyle = classnames('fa', {
            'fa-search': !focus,
            'fa-times': focus
        }, styles.search);

        const dynamic = () => {
            if (focus) {
                const [sep, name] = prefix.split('/').reverse(); // eslint-disable-line
                return (
                    <div className={styles.searchLabel}>
                        在{name || bucket || ` ${getLocalText(region)}区域 `}中搜索
                    </div>
                );
            }

            const prefixs = prefix.split('/');

            const folderDoms = prefixs.map((item, index) => {
                if (item) {
                    const targetObject = prefixs.slice(0, index + 1);

                    return (
                        <span onClick={() => this._redirect(region, bucket, targetObject)}>
                            {item}
                        </span>
                    );
                }
                return null;
            });

            const bucketDoms = bucket ? (<span onClick={() => this._redirect(region, bucket)}>{bucket}</span>) : null;

            return (
                <div className={styles.searchNavigator}>
                    {bucketDoms}
                    {folderDoms}
                </div>
            );
        };

        return (
            <div className={styles.inputWarp}>
                {dynamic()}
                <input value={value}
                    onBlur={this._onBlur}
                    onFocus={this._onFocus}
                    onChange={this._onChange}
                    onKeyDown={evt => this._onKeyDown(evt)}
                />
                <i onClick={this._onSearch} className={searchStyle} />
            </div>
        );
    }

    renderMatchRecords() {
        const {index, records} = this.state;

        if (records.length > 0) {
            return (
                <ul className={styles.match}>
                    {
                        records.map((record, i) => {
                            const {region, bucket, prefix = ''} = record;
                            const klass = classnames({[styles.selected]: index === i});
                            return (
                                <li key={i} className={klass} onMouseDown={() => this._selectMatched(i)} >
                                    <span className={styles.badge}>{getLocalText(region)}</span>
                                    {path.posix.join(bucket, prefix, '/')}
                                </li>
                            );
                        })
                    }
                </ul>
            );
        }

        return null;
    }

    render() {
        const {region, bucket} = this.props;
        const {history} = this.state;

        const leftClassName = classnames('fa', 'fa-angle-left', 'fa-lg', {
            [styles.disable]: !bucket}
        );
        const rightClassName = classnames('fa', 'fa-angle-right', 'fa-lg', {
            [styles.disable]: history.length === 0
        });

        return (
            <div className={styles.container}>
                <div className={styles.nav}>
                    <span className={leftClassName} onClick={this.backward} />
                    <span className={rightClassName} onClick={this.forward} />
                </div>
                <div className={styles.url}>
                    <span className={styles.region}>
                        <i className="fa fa-map-marker fa-fw" />
                        {getLocalText(region)}
                        <i className="fa fa-caret-down fa-fw" />
                        <ul className={styles.range} >
                            {
                                supportRegions.map((r, i) => (
                                    <li key={i} onClick={() => this._selectRegion(r)} >
                                        {getLocalText(r)}
                                    </li>
                                ))
                            }
                        </ul>
                    </span>
                    {this.renderSearch()}
                    {this.renderMatchRecords()}
                </div>
                <SystemBar resize />
            </div>
        );
    }
}

function mapStateToProps(state) {
    return Object.assign({}, state.navigator);
}

export default connect(mapStateToProps)(Navigator);
