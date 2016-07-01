/**
 * Movie component that is responsible for playing movie
 *
 * @todo: Remove state mutation, migrate to Redux reducers
 * @todo: Refactor to be more adapter-like
 */

import React, { Component, PropTypes } from 'react';
import Rating from 'react-star-rating-component';
import CardList from '../card/CardList';
import Butter from '../../api/Butter';
import Torrent from '../../api/Torrent';
import plyr from 'plyr';
import { Link } from 'react-router';


export default class Movie extends Component {

  static propTypes = {
    itemId: PropTypes.string.isRequired,
    activeMode: PropTypes.string.isRequired
  };

  static defaultProps = {
    itemId: ''
  };

  constructor(props) {
    super(props);

    this.butter = new Butter();
    this.torrent = new Torrent();
    this.engine = {};

    this.defaultTorrent = {
      health: '',
      default: { quality: '', magnet: '' },
      '1080p': { quality: '', magnet: '' },
      '720p': { quality: '', magnet: '' },
      '480p': { quality: '', magnet: '' }
    };

    this.state = {
      movie: {
        images: {
          fanart: ''
        },
        runtime: {}
      },
      torrent: this.defaultTorrent,
      similarLoading: false,
      metadataLoading: false,
      torrentInProgress: false,
      torrentProgress: 0
    };
  }

  componentDidMount() {
    this.getAllData(this.props.itemId);
  }

  componentWillReceiveProps(nextProps) {
    this.getAllData(nextProps.itemId);
  }

  getAllData(itemId) {
    this.torrent.destroy();
    this.destroyPlyr();
    this.state.servingUrl = undefined;

    this.getItem(itemId)
      .then(movie => {
        this.getTorrent(itemId, movie.title);
      });

    this.getSimilar(itemId);
  }

  /**
   * Get the details of a movie using the butter api
   *
   * @todo: remove the temporary loctaion reload once until a way is found to
   *        correctly configure destroy and reconfigure plyr
   *
   * @hack: Possbile solution is to remove the video element on change of movie
   */
  async getItem(imdbId) {
    if (document.querySelector('.plyr').plyr) {
      location.reload();
    }

    this.setState({ metadataLoading: true });

    let movie;

    switch (this.props.activeMode) {
      case 'shows':
        movie = await this.butter.getShow(imdbId);
        break;
      case 'movies':
        movie = await this.butter.getMovie(imdbId);
        break;
      default:
        throw new Error('Active mode not found');
    }

    this.setState({ movie, metadataLoading: false });
    document.querySelector('video').setAttribute('poster', this.state.movie.images.fanart.full);

    return movie;
  }

  async getTorrent(imdbId, movieTitle) {
    let torrent;

    try {
      switch (this.props.activeMode) {
        case 'movies':
          torrent = await this.butter.getTorrent(imdbId, this.props.activeMode, {
            searchQuery: movieTitle
          });
          break;
        case 'shows':
          torrent = await this.butter.getTorrent(imdbId, this.props.activeMode, {
            season: 6,
            episode: 1,
            searchQuery: movieTitle
          });
          break;
        default:
          throw new Error('Invalid active mode');
      }

      console.log('logging');
      console.log(torrent);

      // let health;
      //
      // if (torrent['1080p'].magnet || torrent['720p'].magnet) {
      //   health = torrent['1080p'].health || torrent['720p'].health || torrent['480p'].health;
      // }

      this.setState({
        torrent: {
          '1080p': torrent['1080p'] || this.defaultTorrent,
          '720p': torrent['720p'] || this.defaultTorrent,
          '480p': torrent['480p'] || this.defaultTorrent
          // health
        }
      });
    } catch (err) {
      console.log(err);
    }
  }

  async getSimilar(imdbId) {
    this.setState({ similarLoading: true });

    try {
      const similarItems = await this.butter.getSimilar(this.props.activeMode, imdbId);

      this.setState({
        similarLoading: false,
        similarItems,
        isFinished: true
      });
    } catch (err) {
      console.log(err);
    }
  }

  /**
   * @todo
   */
  setupPlyr() {}

  stopTorrent() {
    this.torrent.destroy();
    this.destroyPlyr();
    this.setState({ torrentInProgress: this.torrent.inProgress });
  }

  /**
   * @todo: refactor
   */
  destroyPlyr() {
    if (document.querySelector('.plyr').plyr) {
      document.querySelector('.plyr').plyr.destroy();
      // if (document.querySelector('.plyr button').length) {
      //   document.querySelector('.plyr button').remove();
      // }
    }
  }

  /**
   * @todo: Abstract 'listening' event to Torrent api
   */
  startTorrent(magnetURI) {
    this.engine = this.torrent.start(magnetURI);
    this.setState({ torrentInProgress: this.torrent.inProgress });

    this.engine.server.on('listening', () => {
      const servingUrl = `http://localhost:${this.engine.server.address().port}/`;
      this.setState({ servingUrl });
      console.log('serving......');

      plyr.setup({
        autoplay: true,
        volume: 10
      });
    });
  }

  render() {
    const opacity = { opacity: this.state.metadataLoading ? 0 : 1 };
    const torrentLoadingStatusStyle = { color: 'maroon' };

    return (
      <div className="container">
        <div className="row">
          <div className="col-xs-12">
            <div className="Movie">
              <Link to="/">
                <button
                  className="btn btn-info ion-android-arrow-back"
                  onClick={this.stopTorrent.bind(this)}
                >
                  Back
                </button>
              </Link>
              <button onClick={this.stopTorrent.bind(this)}>
                Stop
              </button>
              <button
                onClick={this.startTorrent.bind(this, this.state.torrent['1080p'].magnet)}
                disabled={!this.state.torrent['1080p'].quality}
              >
                Start 1080p
              </button>
              <button
                onClick={this.startTorrent.bind(this, this.state.torrent['720p'].magnet)}
                disabled={!this.state.torrent['720p'].quality}
              >
                Start 720p
              </button>
              {this.props.activeMode === 'shows' ?
                <button
                  onClick={this.startTorrent.bind(this, this.state.torrent['480p'].magnet)}
                  disabled={!this.state.torrent['480p'].quality}
                >
                  Start 480p
                </button>
                :
                null
              }
              <h4>torrent status: {this.state.torrent.health}</h4>
              <h1>
                {this.state.movie.title}
              </h1>
              <h5>
                Year: {this.state.movie.year}
              </h5>
              <h6>
                Genres: {this.state.movie.genres ?
                  this.state.movie.genres.map(genre => `${genre}, `)
                  : null
                  }
              </h6>
              <h5>
                Length: {this.state.movie.runtime.full}
              </h5>
              <h6>
                {this.state.movie.summary}
              </h6>
              {this.state.movie.rating ?
                <Rating
                  renderStarIcon={() => <span className="ion-android-star"></span>}
                  starColor={'white'}
                  name={'rating'}
                  value={this.state.movie.rating}
                  editing={false}
                />
                :
                null
              }
              <h1 style={torrentLoadingStatusStyle}>
                {
                  !this.state.servingUrl &&
                  this.state.torrentInProgress ?
                  'Loading torrent...' : null
                }
              </h1>

              <div className="plyr" style={opacity}>
                <video controls poster={this.state.movie.images.fanart.full}>
                  <source src={this.state.servingUrl} type="video/mp4" />
                </video>
              </div>
            </div>
          </div>
          <div className="col-xs-12">
            <h3 className="text-center">Similar</h3>
            <CardList
              movies={this.state.similarItems}
              metadataLoading={this.state.similarLoading}
              isFinished={this.state.isFinished}
            />
          </div>
        </div>
      </div>
    );
  }
}
