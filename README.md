# MI OFFset project:  Javascript Version June 2026

### From [MSU Enviroweather](https://enviroweather.msu.edu)

*Pat Bills, Keith Mason, and Brady Strouse*




This is a javascript version of the python2 code written by Michael Keiffer in 2018.  
include a basic web application to input coordinates and odor factor and run the model. 

**This is not the full MI OFFSet application** *This is a preliminary project for updating and optimizing the model for the best user experience.*


Overview
---

This augments and mostly supercedes the [Python 3 version of MI OFFSet](https://gitlab.msu.edu/Enviroweather/maaa_mioffset) created by Pat in Spring of 2026

The Python3 code above includes functions to read the original HDF5 data files (NARR Wind
and the coordinate-to-grid walk file) and save them as JSON format, as well as upload those
to AWS S3.  

The original development started with Javascript front-end (maps, sites) abd model using Python in the backend (wind data, model run, table and polygon generation).  While the Python3 code ran very quickly on a laptop, but when deployed to
AWS Lambda took 10 seconds to run, and sometimes much more or crashed if it was in "cold start" state.  Updgrading this would be expensive and the goal is to find as economical and easy a setup as possible.  We wanted to make the MIOFFset app experience user friendly (with immediate results when selecting locations), inexpensive to deploy both in terms of user expertise, server management.   The solution was to put as much processing inside the user's browser and computer rather than have a server run the calculations.  This is made possible by the translation of the NARR data from large HDF5 time-series into digestible point-files in JSON.  

Re-writing the main model from Python (with Numpy) into the Javascript this repository was initially done by AI, which determined that the Numpy equivalent Typescript library was not needed at all and wrote it's own functions to replace the few Numpy features the model used. 

The rest of the code for translating Lat/Lon to grid coordinates etc was written by hand.  See github commits. 

Requirements
---

This code requires Wind Data to be available in AWS S3 storage as JSON and you must have the have the access keys/codes (see below).   Currently these files are only available to Enviroweather personnel.  

You must have a full javascript environment to run which includes node.js a node module manager (see below)

Install
-------

- install node.js to your computer, at least version 22 (this was build with v22.17)
    - https://nodejs.org/en/download
    - On mac I use [homebrew](https://brew.sh/) (Mac only) and  `brew install node`
- install [pnpm](https://pnpm.io/) a much more efficient and way faster alternative to npm
- clone this repository to your computer
- install all the the things `pnpm install`

Configuration
-------

This system access data on AWS S3 so you must add access keys to this project. 

It is best in AWS to create a new IAM user that has very limited access, specifically 
only to read from S3 in that region.   Details of this AWS account are available in
a document from the Enviroweather project. 

```
FOD_AWS_REGION=
FOD_AWS_ACCESS_KEY_ID=
FOD_AWS_SECRET_ACCESS_KEY=
S3_BUCKET_NAME=
```

The variables with `FOD_` prefix correspond to the same `AWS_` variables used when 
given an AWS IAM user acess to resources.  However because Netlify restricts the use 
of these variable names the "FOD" was added.   FOD was the name of the python model.  

Running
-------

```sh
pnpm run dev

# or start the server and open the app in a new browser tab
pnpm run dev -- --open
```

Building
--------

To create a production version of your app:

```sh
pnpm run build
```

You can preview the production build with `pnpm run preview`.


Deploy
------

Deployment is not really necessary as this repo will be subsumed by the main MI Offset project and deployed as part of that project. 

However during testing the web app was deployed to Netlify which requires

1) a Netlify free account
2) a github free account
3) a new public github repository to hold this code
4) this repository pushed to that public github repository
5) start a new netlify project
    - add from a github repository, which initiates the installation of the Netlify app
      to your github account.  Suggested to only give netlify access only to the this one repo
    - I also added a deploy key to the repo but that may not have been necessary after installing
      the netlify 'app' into github (which can only be done when you start a new netlify project)
    - add the variables from .env to to the env variables for the Netlify project
    - initiate a netlify deployment, pull from the github repo


